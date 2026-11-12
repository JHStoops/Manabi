import type { Pool } from 'pg';
import { query } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedLesson, seedUser } from '../../test/fixtures';
import type { NewXpEvent } from './queries';
import { insertXpEvent } from './queries';

// Integration tests for migration 0003: enrollments, the XP ledger, streak stats, boosters and
// lesson progress. Raw SQL here exercises constraints directly; application code keeps its SQL
// in queries.ts files.

async function seedLearner(pool: Pool) {
  const courseId = await seedCourse(pool);
  const user = await seedUser(pool);
  return { courseId, userId: user.id };
}

function award(userId: number, courseId: number, overrides: Partial<NewXpEvent> = {}): NewXpEvent {
  return {
    userId,
    courseId,
    baseAmount: 10,
    multiplier: 1.5,
    amount: 15,
    reason: 'lesson_new',
    refId: 1,
    // 23:30 UTC is already the next day in Tokyo.
    earnedAt: new Date('2026-11-10T23:30:00Z'),
    localDate: '2026-11-11',
    ...overrides,
  };
}

describeWithDb('XP and progress schema (migration 0003)', () => {
  const pool = useTestDatabase();

  describe('xp_events (DR-04, DR-05, FR-170)', () => {
    it('records base amount, multiplier, amount and the local date', async () => {
      const { courseId, userId } = await seedLearner(pool());
      const row = await insertXpEvent(pool(), award(userId, courseId));
      expect(row).toMatchObject({
        base_amount: 10,
        multiplier: '1.50',
        amount: 15,
        reason: 'lesson_new',
        ref_id: 1,
        earned_at: new Date('2026-11-10T23:30:00Z'),
        local_date: '2026-11-11',
      });
    });

    it('rejects UPDATE and DELETE', async () => {
      const { courseId, userId } = await seedLearner(pool());
      const row = await insertXpEvent(pool(), award(userId, courseId));
      await expect(
        query(pool(), `UPDATE xp_events SET amount = 100 WHERE id = $1`, [row.id]),
      ).rejects.toMatchObject({
        code: '23001',
        message: 'xp_events is append-only: UPDATE is not allowed',
      });
      await expect(
        query(pool(), `DELETE FROM xp_events WHERE id = $1`, [row.id]),
      ).rejects.toMatchObject({
        code: '23001',
        message: 'xp_events is append-only: DELETE is not allowed',
      });
      await expect(query(pool(), `TRUNCATE xp_events`)).rejects.toMatchObject({ code: '23001' });
      expect(await query(pool(), `SELECT amount FROM xp_events`)).toEqual([{ amount: 15 }]);
    });

    it('keeps amounts consistent: positive base, multiplier at least 1, amount not below base', async () => {
      const { courseId, userId } = await seedLearner(pool());
      for (const bad of [
        { baseAmount: 0, amount: 0 },
        { multiplier: 0.5, amount: 5 },
        { amount: 9 },
        { reason: 'Lesson New' },
      ]) {
        await expect(insertXpEvent(pool(), award(userId, courseId, bad))).rejects.toMatchObject({
          code: '23514',
        });
      }
    });

    it('keeps the local date within a day of the UTC date', async () => {
      const { courseId, userId } = await seedLearner(pool());
      await insertXpEvent(pool(), award(userId, courseId, { localDate: '2026-11-09' }));
      await expect(
        insertXpEvent(pool(), award(userId, courseId, { localDate: '2026-11-12' })),
      ).rejects.toMatchObject({ constraint: 'xp_events_local_date_near_utc' });
    });
  });

  describe('enrollments and user_stats', () => {
    it('keeps XP and level per course, non-negative', async () => {
      const { courseId, userId } = await seedLearner(pool());
      await query(pool(), `INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2)`, [
        userId,
        courseId,
      ]);
      expect(await query(pool(), `SELECT total_xp, level FROM enrollments`)).toEqual([
        { total_xp: 0, level: 1 },
      ]);
      await expect(
        query(pool(), `UPDATE enrollments SET total_xp = -1 WHERE user_id = $1`, [userId]),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        query(pool(), `INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2)`, [
          userId,
          courseId,
        ]),
      ).rejects.toMatchObject({ code: '23505' });
    });

    it('holds at most 2 freezes and a longest streak no shorter than the current one (FR-164)', async () => {
      const { userId } = await seedLearner(pool());
      await query(pool(), `INSERT INTO user_stats (user_id) VALUES ($1)`, [userId]);
      await expect(
        query(pool(), `UPDATE user_stats SET freezes = 3 WHERE user_id = $1`, [userId]),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        query(pool(), `UPDATE user_stats SET current_streak = 5 WHERE user_id = $1`, [userId]),
      ).rejects.toMatchObject({ constraint: 'user_stats_longest_at_least_current' });
      await query(
        pool(),
        `UPDATE user_stats SET current_streak = 5, longest_streak = 5,
                last_active_date = '2026-11-11' WHERE user_id = $1`,
        [userId],
      );
      expect(await query(pool(), `SELECT last_active_date FROM user_stats`)).toEqual([
        { last_active_date: '2026-11-11' },
      ]);
    });
  });

  describe('boosters (FR-169)', () => {
    const insertBooster = (userId: number, multiplier: number, start: string, end: string) =>
      query(
        pool(),
        `INSERT INTO boosters (user_id, multiplier, reason, started_at, ends_at)
         VALUES ($1, $2, 'unit_complete', $3, $4)`,
        [userId, multiplier, start, end],
      );

    it('allows at most one active booster per learner at any time', async () => {
      const { userId } = await seedLearner(pool());
      const other = await seedUser(pool(), { username: 'other' });
      await insertBooster(userId, 2, '2026-11-11T10:00:00Z', '2026-11-11T10:15:00Z');
      await expect(
        insertBooster(userId, 3, '2026-11-11T10:05:00Z', '2026-11-11T10:20:00Z'),
      ).rejects.toMatchObject({ code: '23P01', constraint: 'boosters_one_active_per_user' });
      // Another learner's booster may overlap.
      await insertBooster(other.id, 3, '2026-11-11T10:05:00Z', '2026-11-11T10:20:00Z');
      // Replacing: end the running booster at the moment the new one starts.
      await query(
        pool(),
        `UPDATE boosters SET ends_at = '2026-11-11T10:05:00Z' WHERE user_id = $1`,
        [userId],
      );
      await insertBooster(userId, 3, '2026-11-11T10:05:00Z', '2026-11-11T10:20:00Z');
    });

    it('requires a multiplier above 1 and an end after the start', async () => {
      const { userId } = await seedLearner(pool());
      await expect(
        insertBooster(userId, 1, '2026-11-11T10:00:00Z', '2026-11-11T10:15:00Z'),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        insertBooster(userId, 2, '2026-11-11T10:00:00Z', '2026-11-11T10:00:00Z'),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('lesson progress and sessions', () => {
    it('keeps one progress row per lesson with an accuracy percentage', async () => {
      const { courseId, userId } = await seedLearner(pool());
      const { lessonId } = await seedLesson(pool(), courseId);
      const insert = (accuracy: number) =>
        query(
          pool(),
          `INSERT INTO lesson_progress (user_id, lesson_id, completed_at, best_accuracy)
           VALUES ($1, $2, now(), $3)`,
          [userId, lessonId, accuracy],
        );
      await expect(insert(101)).rejects.toMatchObject({ code: '23514' });
      await insert(92);
      await expect(insert(80)).rejects.toMatchObject({ code: '23505' });
    });

    it('stores session state as an object with an expiry (FR-050)', async () => {
      const { courseId, userId } = await seedLearner(pool());
      const { lessonId } = await seedLesson(pool(), courseId);
      const insert = (state: string, expires: string) =>
        query(
          pool(),
          `INSERT INTO lesson_sessions (user_id, lesson_id, state, expires_at)
           VALUES ($1, $2, $3, now() + $4::interval)`,
          [userId, lessonId, state, expires],
        );
      await expect(insert('[]', '24 hours')).rejects.toMatchObject({ code: '23514' });
      await expect(insert('{}', '-1 hour')).rejects.toMatchObject({
        constraint: 'lesson_sessions_expires_after_created',
      });
      await insert('{"exercises":[]}', '24 hours');
    });

    it('blocks deleting a lesson that has progress (DR-03)', async () => {
      const { courseId, userId } = await seedLearner(pool());
      const { lessonId } = await seedLesson(pool(), courseId);
      await query(
        pool(),
        `INSERT INTO lesson_progress (user_id, lesson_id, completed_at, best_accuracy)
         VALUES ($1, $2, now(), 100)`,
        [userId, lessonId],
      );
      await expect(
        query(pool(), `DELETE FROM lessons WHERE id = $1`, [lessonId]),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });
});

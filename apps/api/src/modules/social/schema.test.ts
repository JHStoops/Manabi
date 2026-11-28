import { query } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedItems, seedUser } from '../../test/fixtures';
import { deleteUser } from '../auth/queries';

// Integration tests for migration 0004 (social and admin tables). Raw SQL here exercises
// constraints directly; application code keeps its SQL in queries.ts files.

describeWithDb('social and admin schema (migration 0004)', () => {
  const pool = useTestDatabase();

  const twoLearners = async () => {
    const a = await seedUser(pool(), { username: 'aki' });
    const b = await seedUser(pool(), { username: 'ben' });
    return [a.id, b.id] as const;
  };

  describe('follows (FR-182)', () => {
    it('is one-way, unique per pair, and never self', async () => {
      const [a, b] = await twoLearners();
      const follow = (x: number, y: number) =>
        query(pool(), `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)`, [x, y]);
      await follow(a, b);
      await follow(b, a);
      await expect(follow(a, b)).rejects.toMatchObject({ code: '23505' });
      await expect(follow(a, a)).rejects.toMatchObject({ constraint: 'follows_not_self' });
    });
  });

  describe('nudges (FR-183)', () => {
    const nudge = (
      from: number,
      to: number,
      kind: string,
      localDate: string,
      sentAt = `${localDate}T12:00:00Z`,
    ) =>
      query(
        pool(),
        `INSERT INTO nudges (from_user_id, to_user_id, kind, local_date, sent_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [from, to, kind, localDate, sentAt],
      );

    it('allows one nudge per sender, recipient and day', async () => {
      const [a, b] = await twoLearners();
      await nudge(a, b, 'nice_work', '2026-11-11');
      await expect(nudge(a, b, 'keep_going', '2026-11-11')).rejects.toMatchObject({
        constraint: 'nudges_one_per_day_key',
      });
      await nudge(b, a, 'keep_going', '2026-11-11');
      await nudge(a, b, 'keep_going', '2026-11-12');
    });

    it('keeps the local date within a day of the UTC date', async () => {
      const [a, b] = await twoLearners();
      await nudge(a, b, 'nice_work', '2026-11-12', '2026-11-11T20:00:00Z');
      await expect(
        nudge(b, a, 'nice_work', '2026-11-13', '2026-11-11T20:00:00Z'),
      ).rejects.toMatchObject({ constraint: 'nudges_local_date_near_utc' });
    });

    it('limits kinds and forbids nudging oneself', async () => {
      const [a, b] = await twoLearners();
      await expect(nudge(a, b, 'hurry_up', '2026-11-11')).rejects.toMatchObject({
        code: '23514',
      });
      await expect(nudge(a, a, 'nice_work', '2026-11-11')).rejects.toMatchObject({
        constraint: 'nudges_not_self',
      });
    });
  });

  describe('weekly_results (FR-181)', () => {
    it('starts weeks on Monday and ranks from 1', async () => {
      const [a] = await twoLearners();
      const insert = (week: string, rank: number) =>
        query(
          pool(),
          `INSERT INTO weekly_results (week_start, user_id, xp, rank) VALUES ($1, $2, 120, $3)`,
          [week, a, rank],
        );
      await expect(insert('2026-11-10', 1)).rejects.toMatchObject({ code: '23514' });
      await expect(insert('2026-11-09', 0)).rejects.toMatchObject({ code: '23514' });
      await insert('2026-11-09', 1);
      expect(await query(pool(), `SELECT week_start FROM weekly_results`)).toEqual([
        { week_start: '2026-11-09' },
      ]);
    });
  });

  describe('achievements (FR-165)', () => {
    it('awards each defined achievement once per learner', async () => {
      const [a] = await twoLearners();
      // streak_7 is seeded by migration 0015.
      const earn = (key: string) =>
        query(pool(), `INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1, $2)`, [
          a,
          key,
        ]);
      await earn('streak_7');
      await expect(earn('streak_7')).rejects.toMatchObject({ code: '23505' });
      await expect(earn('unknown')).rejects.toMatchObject({ code: '23503' });
      await expect(
        query(
          pool(),
          `INSERT INTO achievements (key, group_key, metric, threshold, title)
           VALUES ('streak_0', 'streak', 'streak_days', 0, 'Nothing')`,
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('answer_reports (FR-054, FR-229)', () => {
    const seedExercise = async () => {
      const courseId = await seedCourse(pool());
      const [itemId] = await seedItems(pool(), courseId, 1);
      const [row] = await query<{ id: number }>(
        pool(),
        `INSERT INTO exercises (item_id, type, payload, origin)
         VALUES ($1, 'meaning_type', '{}', 'authored') RETURNING id`,
        [itemId],
      );
      return { exerciseId: row!.id, itemId: itemId! };
    };

    const report = (
      userId: number,
      target: { exerciseId?: number | null; itemId?: number | null },
      type = 'meaning_type',
      payload = '{"prompt":"水"}',
    ) =>
      query<{ id: number; status: string }>(
        pool(),
        `INSERT INTO answer_reports
           (user_id, exercise_id, item_id, exercise_type, exercise_payload, given_answer)
         VALUES ($1, $2, $3, $4, $5, 'aqua') RETURNING id, status`,
        [userId, target.exerciseId ?? null, target.itemId ?? null, type, payload],
      );

    it('accepts reports on stored and on session-generated exercises', async () => {
      const [learner] = await twoLearners();
      const { exerciseId, itemId } = await seedExercise();
      await report(learner, { exerciseId });
      // A generated exercise has no row: the report keeps its copy and points at the item.
      await report(learner, { itemId });
      await expect(report(learner, {})).rejects.toMatchObject({
        constraint: 'answer_reports_has_target',
      });
      await expect(report(learner, { itemId }, 'Meaning Type')).rejects.toMatchObject({
        code: '23514',
      });
      await expect(report(learner, { itemId }, 'meaning_type', '[]')).rejects.toMatchObject({
        code: '23514',
      });
    });

    it('records a resolution time exactly when the report is closed', async () => {
      const [learner] = await twoLearners();
      const admin = await seedUser(pool(), { username: 'admin', role: 'admin' });
      const { exerciseId } = await seedExercise();
      const [reportRow] = await report(learner, { exerciseId });
      expect(reportRow!.status).toBe('open');
      await expect(
        query(pool(), `UPDATE answer_reports SET status = 'accepted' WHERE id = $1`, [
          reportRow!.id,
        ]),
      ).rejects.toMatchObject({ constraint: 'answer_reports_resolved_when_closed' });
      await expect(
        query(pool(), `UPDATE answer_reports SET status = 'maybe' WHERE id = $1`, [reportRow!.id]),
      ).rejects.toMatchObject({ code: '23514' });
      await query(
        pool(),
        `UPDATE answer_reports SET status = 'accepted', resolved_by = $2, resolved_at = now()
          WHERE id = $1`,
        [reportRow!.id, admin.id],
      );

      // DR-07: deleting the resolving admin keeps the resolution, without the admin.
      await deleteUser(pool(), admin.id);
      expect(await query(pool(), `SELECT status, resolved_by FROM answer_reports`)).toEqual([
        { status: 'accepted', resolved_by: null },
      ]);
    });
  });

  describe('import_runs (FR-226)', () => {
    it('has a finish time exactly when the run is no longer running', async () => {
      const [run] = await query<{ id: number; status: string; summary: object }>(
        pool(),
        `INSERT INTO import_runs (importer) VALUES ('kanjidic2') RETURNING id, status, summary`,
      );
      expect(run).toMatchObject({ status: 'running', summary: {} });
      await expect(
        query(pool(), `UPDATE import_runs SET status = 'succeeded' WHERE id = $1`, [run!.id]),
      ).rejects.toMatchObject({ constraint: 'import_runs_finished_when_done' });
      await expect(
        query(pool(), `UPDATE import_runs SET summary = '[]' WHERE id = $1`, [run!.id]),
      ).rejects.toMatchObject({ code: '23514' });
      await query(
        pool(),
        `UPDATE import_runs SET status = 'failed', finished_at = now(),
                summary = '{"error":"bad file"}' WHERE id = $1`,
        [run!.id],
      );
    });
  });
});

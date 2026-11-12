import { query, queryOne } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedItems, seedLesson, seedUser, tokenHash } from '../../test/fixtures';
import { insertXpEvent } from '../courses/queries';
import { insertItemProgress, insertReviewLog } from '../reviews/queries';
import { deleteUser } from './queries';

// Integration tests for migration 0002 (account tables). Raw SQL here exercises constraints
// directly; application code keeps its SQL in queries.ts files.

describeWithDb('account schema (migration 0002)', () => {
  const pool = useTestDatabase();

  describe('users', () => {
    it('creates a learner with default role, settings and no password change pending', async () => {
      const user = await seedUser(pool());
      expect(user).toMatchObject({
        username: 'learner',
        role: 'learner',
        must_change_password: false,
        password_expires_at: null,
        settings: {},
        disabled_at: null,
      });
    });

    it('allows only the admin and learner roles (FR-006)', async () => {
      await seedUser(pool(), { username: 'boss', role: 'admin' });
      await expect(
        seedUser(pool(), { username: 'writer', role: 'author' as never }),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('accepts only an Argon2id hash as the password (NFR-10)', async () => {
      await expect(
        seedUser(pool(), { passwordHash: 'correct horse battery staple' }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        seedUser(pool(), { passwordHash: '$2b$12$bcryptbcryptbcryptbcrypt' }),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('keeps usernames and emails unique regardless of case', async () => {
      await seedUser(pool(), { username: 'Hana', email: 'hana@example.com' });
      await expect(
        seedUser(pool(), { username: 'hana', email: 'other@example.com' }),
      ).rejects.toMatchObject({ code: '23505', constraint: 'users_username_key' });
      await expect(
        seedUser(pool(), { username: 'hana2', email: 'HANA@example.com' }),
      ).rejects.toMatchObject({ code: '23505', constraint: 'users_email_key' });
      // Several accounts may have no email.
      await seedUser(pool(), { username: 'a', email: null });
      await seedUser(pool(), { username: 'b', email: null });
    });

    it('rejects usernames that could be mistaken for an email, and malformed emails', async () => {
      await expect(seedUser(pool(), { username: 'a@b' })).rejects.toMatchObject({
        code: '23514',
      });
      await expect(seedUser(pool(), { username: 'two words' })).rejects.toMatchObject({
        code: '23514',
      });
      await expect(seedUser(pool(), { email: 'not-an-email' })).rejects.toMatchObject({
        code: '23514',
      });
    });

    it('requires settings to be a JSON object', async () => {
      const user = await seedUser(pool());
      await expect(
        query(pool(), `UPDATE users SET settings = '[]' WHERE id = $1`, [user.id]),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('allows a temporary password expiry only with must_change_password (FR-005)', async () => {
      const user = await seedUser(pool());
      await expect(
        query(
          pool(),
          `UPDATE users SET password_expires_at = now() + interval '7 days' WHERE id = $1`,
          [user.id],
        ),
      ).rejects.toMatchObject({ constraint: 'users_password_expiry_needs_change' });
      await query(
        pool(),
        `UPDATE users SET must_change_password = true,
                          password_expires_at = now() + interval '7 days' WHERE id = $1`,
        [user.id],
      );
    });
  });

  describe('tokens', () => {
    it('stores invite, session and reset tokens only as SHA-256 hex digests (NFR-10)', async () => {
      const admin = await seedUser(pool(), { username: 'admin', role: 'admin' });
      const rawToken = 'q7Xb3mZp0kLr8sTv2wYc5nHd9fGj4aEu6iOx1yRz0Bw';
      const statements: [string, unknown[]][] = [
        [
          `INSERT INTO invites (token_hash, created_by, expires_at)
           VALUES ($1, $2, now() + interval '7 days')`,
          [admin.id],
        ],
        [
          `INSERT INTO sessions (user_id, token_hash, client_kind, expires_at)
           VALUES ($2, $1, 'web', now() + interval '30 days')`,
          [admin.id],
        ],
        [
          `INSERT INTO password_resets (user_id, token_hash, origin, expires_at)
           VALUES ($2, $1, 'email', now() + interval '1 hour')`,
          [admin.id],
        ],
      ];
      for (const [sql, params] of statements) {
        await expect(query(pool(), sql, [rawToken, ...params])).rejects.toMatchObject({
          code: '23514',
        });
        await query(pool(), sql, [tokenHash(1), ...params]);
        await expect(query(pool(), sql, [tokenHash(1), ...params])).rejects.toMatchObject({
          code: '23505',
        });
      }
    });

    it('limits session client kinds and reset origins', async () => {
      const user = await seedUser(pool());
      await expect(
        query(
          pool(),
          `INSERT INTO sessions (user_id, token_hash, client_kind, expires_at)
           VALUES ($1, $2, 'desktop', now() + interval '30 days')`,
          [user.id, tokenHash(2)],
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        query(
          pool(),
          `INSERT INTO password_resets (user_id, token_hash, origin, expires_at)
           VALUES ($1, $2, 'sms', now() + interval '1 hour')`,
          [user.id, tokenHash(3)],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('keeps invites single-use: used and revoked are exclusive (FR-001, FR-002)', async () => {
      const learner = await seedUser(pool());
      await expect(
        query(
          pool(),
          `INSERT INTO invites (token_hash, expires_at, used_by, used_at, revoked_at)
           VALUES ($1, now() + interval '7 days', $2, now(), now())`,
          [tokenHash(4), learner.id],
        ),
      ).rejects.toMatchObject({ constraint: 'invites_used_or_revoked' });
      await expect(
        query(
          pool(),
          `INSERT INTO invites (token_hash, expires_at, used_by)
           VALUES ($1, now() + interval '7 days', $2)`,
          [tokenHash(4), learner.id],
        ),
      ).rejects.toMatchObject({ constraint: 'invites_used_by_needs_used_at' });
      await expect(
        query(
          pool(),
          `INSERT INTO invites (token_hash, role, expires_at)
           VALUES ($1, 'author', now() + interval '7 days')`,
          [tokenHash(4)],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('deleting an account (DR-07)', () => {
    it('removes sessions, progress, logs, notes, follows and nudges, and anonymizes reports', async () => {
      const courseId = await seedCourse(pool());
      const [itemId] = await seedItems(pool(), courseId, 1);
      const { lessonId } = await seedLesson(pool(), courseId);
      const admin = await seedUser(pool(), { username: 'admin', role: 'admin' });
      const gone = await seedUser(pool(), { username: 'gone' });
      const stays = await seedUser(pool(), { username: 'stays' });
      const [exercise] = await query<{ id: number }>(
        pool(),
        `INSERT INTO exercises (item_id, type, payload, origin)
         VALUES ($1, 'meaning_choice', '{}', 'generated') RETURNING id`,
        [itemId],
      );

      await query(
        pool(),
        `INSERT INTO invites (token_hash, created_by, expires_at, used_by, used_at)
         VALUES ($1, $2, now() + interval '7 days', $3, now())`,
        [tokenHash(10), admin.id, gone.id],
      );
      await query(
        pool(),
        `INSERT INTO sessions (user_id, token_hash, client_kind, expires_at)
         VALUES ($1, $2, 'mobile', now() + interval '30 days')`,
        [gone.id, tokenHash(11)],
      );
      await query(
        pool(),
        `INSERT INTO password_resets (user_id, token_hash, origin, expires_at)
         VALUES ($1, $2, 'admin', now() + interval '1 day')`,
        [gone.id, tokenHash(12)],
      );
      await query(pool(), `INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2)`, [
        gone.id,
        courseId,
      ]);
      await query(
        pool(),
        `INSERT INTO lesson_progress (user_id, lesson_id, completed_at, best_accuracy)
         VALUES ($1, $2, now(), 90)`,
        [gone.id, lessonId],
      );
      await query(
        pool(),
        `INSERT INTO lesson_sessions (user_id, lesson_id, state, expires_at)
         VALUES ($1, $2, '{}', now() + interval '24 hours')`,
        [gone.id, lessonId],
      );
      await insertItemProgress(pool(), {
        userId: gone.id,
        itemId: itemId!,
        facet: 'meaning',
        stage: 1,
        dueAt: new Date(),
      });
      for (const userId of [gone.id, stays.id]) {
        await insertReviewLog(pool(), {
          userId,
          itemId: itemId!,
          facet: 'meaning',
          exerciseType: 'meaning_choice',
          correct: true,
          stageBefore: 1,
          stageAfter: 2,
        });
        await insertXpEvent(pool(), {
          userId,
          courseId,
          baseAmount: 10,
          multiplier: 1,
          amount: 10,
          reason: 'lesson_new',
          refId: lessonId,
          earnedAt: new Date(),
          localDate: (await queryOne<{ d: string }>(pool(), `SELECT current_date AS d`))!.d,
        });
      }
      await query(pool(), `INSERT INTO user_stats (user_id) VALUES ($1)`, [gone.id]);
      await query(pool(), `INSERT INTO user_notes (user_id, item_id, body) VALUES ($1, $2, 'x')`, [
        gone.id,
        itemId,
      ]);
      await query(
        pool(),
        `INSERT INTO boosters (user_id, multiplier, reason, ends_at)
         VALUES ($1, 1.5, 'perfect_lesson', now() + interval '10 minutes')`,
        [gone.id],
      );
      await query(
        pool(),
        `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2), ($2, $1)`,
        [gone.id, stays.id],
      );
      await query(
        pool(),
        `INSERT INTO nudges (from_user_id, to_user_id, kind, local_date)
         VALUES ($1, $2, 'nice_work', current_date), ($2, $1, 'keep_going', current_date)`,
        [gone.id, stays.id],
      );
      await query(
        pool(),
        `INSERT INTO weekly_results (week_start, user_id, xp, rank) VALUES ('2026-11-09', $1, 10, 1)`,
        [gone.id],
      );
      await query(
        pool(),
        `INSERT INTO achievements (key, group_key, metric, threshold, title)
         VALUES ('streak_7', 'streak', 'streak_days', 7, 'One week')`,
      );
      await query(
        pool(),
        `INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1, 'streak_7')`,
        [gone.id],
      );
      await query(
        pool(),
        `INSERT INTO answer_reports (user_id, exercise_id, exercise_type, exercise_payload, given_answer)
         VALUES ($1, $2, 'meaning_choice', '{}', 'aqua')`,
        [gone.id, exercise!.id],
      );

      expect(await deleteUser(pool(), gone.id)).toBe(true);
      expect(await deleteUser(pool(), gone.id)).toBe(false);

      const userTables = [
        'sessions',
        'password_resets',
        'enrollments',
        'lesson_progress',
        'lesson_sessions',
        'item_progress',
        'review_log',
        'xp_events',
        'user_stats',
        'user_notes',
        'boosters',
        'weekly_results',
        'user_achievements',
      ];
      for (const table of userTables) {
        const row = await queryOne<{ n: number }>(
          pool(),
          // Table names come from the constant list above, not from input.
          `SELECT count(*) AS n FROM ${table} WHERE user_id = $1`,
          [gone.id],
        );
        expect({ table, n: row!.n }).toEqual({ table, n: 0 });
      }
      expect(
        await query(pool(), `SELECT 1 FROM follows WHERE $1 IN (follower_id, followee_id)`, [
          gone.id,
        ]),
      ).toHaveLength(0);
      expect(
        await query(pool(), `SELECT 1 FROM nudges WHERE $1 IN (from_user_id, to_user_id)`, [
          gone.id,
        ]),
      ).toHaveLength(0);
      // The other learner's ledger and log are untouched.
      expect(
        await query(pool(), `SELECT 1 FROM xp_events WHERE user_id = $1`, [stays.id]),
      ).toHaveLength(1);
      expect(
        await query(pool(), `SELECT 1 FROM review_log WHERE user_id = $1`, [stays.id]),
      ).toHaveLength(1);
      // The report stays for the author, without the reporter.
      expect(await query(pool(), `SELECT user_id, given_answer FROM answer_reports`)).toEqual([
        { user_id: null, given_answer: 'aqua' },
      ]);
      // The invite keeps its history, without the deleted account.
      expect(await query(pool(), `SELECT created_by, used_by FROM invites`)).toEqual([
        { created_by: admin.id, used_by: null },
      ]);
    });

    it('nulls the creator of invites when that admin is deleted', async () => {
      const admin = await seedUser(pool(), { username: 'admin', role: 'admin' });
      await query(
        pool(),
        `INSERT INTO invites (token_hash, created_by, expires_at)
         VALUES ($1, $2, now() + interval '7 days')`,
        [tokenHash(20), admin.id],
      );
      await deleteUser(pool(), admin.id);
      expect(await query(pool(), `SELECT created_by FROM invites`)).toEqual([{ created_by: null }]);
    });
  });
});

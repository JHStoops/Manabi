import type { FastifyInstance } from 'fastify';
import { query } from '../../db/db';
import { settleStreaksJob } from '../../jobs/settleStreaks';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import { insertEnrollment } from '../courses/queries';
import { awardXp } from '../courses/service';

// Integration tests for the daily goal and streak (issue #38): FR-161, FR-163, FR-164.

describeWithDb('streak and daily goal', () => {
  const pool = useTestDatabase();

  async function learner(username: string, timeZone = 'UTC') {
    const user = await seedUser(pool(), { username, timeZone });
    const [existing] = await query<{ id: number }>(pool(), `SELECT id FROM courses`);
    const courseId = existing?.id ?? (await seedCourse(pool()));
    await insertEnrollment(pool(), user.id, courseId);
    return { userId: user.id, courseId };
  }

  const stats = async (userId: number) =>
    (
      await query(
        pool(),
        `SELECT current_streak, longest_streak, freezes, last_active_date::text
           FROM user_stats WHERE user_id = $1`,
        [userId],
      )
    )[0];

  it('counts a day once the learner reaches 10 XP, summed over awards', async () => {
    const who = await learner('a');
    const at = new Date('2026-11-20T08:00:00Z');
    await awardXp(pool(), { ...who, reason: 'review_correct', refId: null, at });
    expect((await stats(who.userId))?.current_streak ?? 0).toBe(0);
    await awardXp(pool(), { ...who, reason: 'lesson_new', refId: null, at });
    expect(await stats(who.userId)).toMatchObject({
      current_streak: 1,
      last_active_date: '2026-11-20',
    });
    // More XP the same day changes nothing; the next day adds one.
    await awardXp(pool(), { ...who, reason: 'lesson_new', refId: null, at });
    expect((await stats(who.userId))?.current_streak).toBe(1);
    const next = new Date('2026-11-21T08:00:00Z');
    await awardXp(pool(), { ...who, reason: 'lesson_new', refId: null, at: next });
    expect(await stats(who.userId)).toMatchObject({ current_streak: 2, longest_streak: 2 });
  });

  it('uses the learner time zone for the day', async () => {
    const tokyo = await learner('tokyo', 'Asia/Tokyo');
    const la = await learner('la', 'America/Los_Angeles');
    // 14:30 UTC is 23:30 on the 20th in Tokyo; 15:30 UTC is 00:30 on the 21st there.
    for (const who of [tokyo, la]) {
      await awardXp(pool(), {
        ...who,
        reason: 'lesson_new',
        refId: null,
        at: new Date('2026-11-20T14:30:00Z'),
      });
      await awardXp(pool(), {
        ...who,
        reason: 'lesson_new',
        refId: null,
        at: new Date('2026-11-20T15:30:00Z'),
      });
    }
    expect(await stats(tokyo.userId)).toMatchObject({
      current_streak: 2,
      last_active_date: '2026-11-21',
    });
    expect(await stats(la.userId)).toMatchObject({
      current_streak: 1,
      last_active_date: '2026-11-20',
    });
  });

  it('nightly job resets an absent learner and spends a freeze for another', async () => {
    const absent = await learner('absent');
    const frozen = await learner('frozen');
    const fine = await learner('fine');
    await query(
      pool(),
      `INSERT INTO user_stats (user_id, current_streak, longest_streak, freezes, last_active_date)
       SELECT v.id, v.streak, 9, v.freezes, (now() AT TIME ZONE 'UTC')::date - v.days
         FROM (VALUES ($1::bigint, 5, 0, 4), ($2::bigint, 5, 1, 2), ($3::bigint, 5, 1, 1))
              AS v (id, streak, freezes, days)`,
      [absent.userId, frozen.userId, fine.userId],
    );

    const handler = settleStreaksJob.handler;
    const context = { db: pool(), log: { info() {} } as never };
    await handler({}, context);
    await handler({}, context);

    expect(await stats(absent.userId)).toMatchObject({ current_streak: 0, freezes: 0 });
    expect(await stats(frozen.userId)).toMatchObject({ current_streak: 5, freezes: 0 });
    // Earned yesterday: nothing missed yet, freeze kept.
    expect(await stats(fine.userId)).toMatchObject({ current_streak: 5, freezes: 1 });

    // A learner who comes back after the reset starts again at 1.
    await awardXp(pool(), { ...absent, reason: 'lesson_new', refId: null });
    expect(await stats(absent.userId)).toMatchObject({ current_streak: 1, longest_streak: 9 });
  });

  describe('GET /me/stats', () => {
    let current: TestApp | undefined;
    let app: FastifyInstance;

    beforeEach(async () => {
      current = await testApp({ pool: pool() });
      app = current.app;
    });
    afterEach(async () => {
      await current?.close();
      current = undefined;
    });

    it('returns the goal, today XP and streak, and needs a sign-in', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/v1/me/stats' })).statusCode).toBe(401);

      const password = 'correct horse battery';
      const user = await seedUser(pool(), {
        username: 'me',
        passwordHash: await hashPassword(password),
      });
      const courseId = await seedCourse(pool());
      await insertEnrollment(pool(), user.id, courseId);
      await query(pool(), `UPDATE users SET settings = '{"dailyGoal": 30}' WHERE id = $1`, [
        user.id,
      ]);
      await awardXp(pool(), { userId: user.id, courseId, reason: 'lesson_new', refId: null });
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: 'me', password },
      });
      const cookies = {
        [SESSION_COOKIE]: login.cookies.find((c) => c.name === SESSION_COOKIE)!.value,
      };

      const response = await app.inject({ method: 'GET', url: '/api/v1/me/stats', cookies });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        dailyGoal: 30,
        todayXp: 10,
        currentStreak: 1,
        longestStreak: 1,
        freezes: 0,
      });
    });
  });
});

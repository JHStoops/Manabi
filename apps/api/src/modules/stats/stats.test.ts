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

  it('the job resets an absent learner and never spends a freeze', async () => {
    const absent = await learner('absent');
    const covered = await learner('covered');
    const fine = await learner('fine');
    await query(
      pool(),
      `INSERT INTO user_stats (user_id, current_streak, longest_streak, freezes, last_active_date)
       SELECT v.id, v.streak, 9, v.freezes, (now() AT TIME ZONE 'UTC')::date - v.days
         FROM (VALUES ($1::bigint, 5, 1, 4), ($2::bigint, 5, 2, 2), ($3::bigint, 5, 1, 1))
              AS v (id, streak, freezes, days)`,
      [absent.userId, covered.userId, fine.userId],
    );

    const context = { db: pool(), log: { info() {} } as never };
    await settleStreaksJob.handler({}, context);
    await settleStreaksJob.handler({}, context);

    // Missed 3 days with 1 freeze: reset, freeze kept.
    expect(await stats(absent.userId)).toMatchObject({ current_streak: 0, freezes: 1 });
    // Missed 1 day with 2 freezes: waits for the learner's choice.
    expect(await stats(covered.userId)).toMatchObject({ current_streak: 5, freezes: 2 });
    // Earned yesterday: nothing missed.
    expect(await stats(fine.userId)).toMatchObject({ current_streak: 5, freezes: 1 });

    // A learner who comes back after the reset starts again at 1.
    await awardXp(pool(), { ...absent, reason: 'lesson_new', refId: null });
    expect(await stats(absent.userId)).toMatchObject({ current_streak: 1, longest_streak: 9 });
  });

  it('XP before answering the freeze offer resets the streak and keeps the freezes', async () => {
    const who = await learner('impatient');
    await query(
      pool(),
      `INSERT INTO user_stats (user_id, current_streak, longest_streak, freezes, last_active_date)
       VALUES ($1, 5, 5, 2, (now() AT TIME ZONE 'UTC')::date - 2)`,
      [who.userId],
    );
    await awardXp(pool(), { ...who, reason: 'lesson_new', refId: null });
    expect(await stats(who.userId)).toMatchObject({
      current_streak: 1,
      longest_streak: 5,
      freezes: 2,
    });
  });

  describe('API', () => {
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

    const password = 'correct horse battery';

    async function signedIn(username: string) {
      const user = await seedUser(pool(), {
        username,
        timeZone: 'UTC',
        passwordHash: await hashPassword(password),
      });
      const courseId = await seedCourse(pool());
      await insertEnrollment(pool(), user.id, courseId);
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: username, password },
      });
      const cookie = login.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
      return {
        userId: user.id,
        courseId,
        // Cookie-authenticated writes need a same-origin Origin header.
        auth: {
          cookies: { [SESSION_COOKIE]: cookie },
          headers: { origin: 'http://localhost:3000' },
        },
      };
    }

    const setStats = (userId: number, streak: number, freezes: number, missed: number) =>
      query(
        pool(),
        `INSERT INTO user_stats (user_id, current_streak, longest_streak, freezes, last_active_date)
         VALUES ($1, $2, $2, $3, (now() AT TIME ZONE 'UTC')::date - $4::int - 1)`,
        [userId, streak, freezes, missed],
      );

    const choose = (me: { auth: object }, payload: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: '/api/v1/me/streak/freezes', payload, ...me.auth });

    it('returns the goal, today XP and streak, and needs a sign-in', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/v1/me/stats' })).statusCode).toBe(401);
      const me = await signedIn('me');
      await query(pool(), `UPDATE users SET settings = '{"dailyGoal": 30}' WHERE id = $1`, [
        me.userId,
      ]);
      await awardXp(pool(), {
        userId: me.userId,
        courseId: me.courseId,
        reason: 'lesson_new',
        refId: null,
      });

      const response = await app.inject({ method: 'GET', url: '/api/v1/me/stats', ...me.auth });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        dailyGoal: 30,
        todayXp: 10,
        currentStreak: 1,
        longestStreak: 1,
        freezes: 0,
        pendingFreezeSpend: null,
      });
    });

    it('reports the catch-up gap, and yes spends the freezes and keeps the streak', async () => {
      const me = await signedIn('catchup');
      await setStats(me.userId, 6, 2, 2);
      const get = await app.inject({ method: 'GET', url: '/api/v1/me/stats', ...me.auth });
      expect(get.json()).toMatchObject({ currentStreak: 6, pendingFreezeSpend: { days: 2 } });

      const yes = await choose(me, { spend: true });
      expect(yes.statusCode).toBe(200);
      expect(yes.json()).toMatchObject({ currentStreak: 6, freezes: 0, pendingFreezeSpend: null });

      // Today now extends the streak, and reaching 7 earns a freeze.
      await awardXp(pool(), {
        userId: me.userId,
        courseId: me.courseId,
        reason: 'lesson_new',
        refId: null,
      });
      expect(await stats(me.userId)).toMatchObject({ current_streak: 7, freezes: 1 });

      // Nothing is pending any more.
      expect((await choose(me, { spend: true })).statusCode).toBe(409);
    });

    it('no resets the streak and keeps the freezes', async () => {
      const me = await signedIn('decline');
      await setStats(me.userId, 6, 1, 1);
      const no = await choose(me, { spend: false });
      expect(no.statusCode).toBe(200);
      expect(no.json()).toMatchObject({ currentStreak: 0, freezes: 1, pendingFreezeSpend: null });
      await awardXp(pool(), {
        userId: me.userId,
        courseId: me.courseId,
        reason: 'lesson_new',
        refId: null,
      });
      expect(await stats(me.userId)).toMatchObject({ current_streak: 1, freezes: 1 });
    });

    it('is a 409 when the gap is not covered, and validates the body', async () => {
      const me = await signedIn('nothing');
      await setStats(me.userId, 6, 1, 3);
      expect((await choose(me, { spend: true })).statusCode).toBe(409);
      expect((await choose(me, { spend: 'yes' })).statusCode).toBe(400);
      expect(await stats(me.userId)).toMatchObject({ current_streak: 6, freezes: 1 });
    });
  });
});

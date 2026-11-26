import { query } from '../../db/db';
import { closeWeekJob } from '../../jobs/closeWeek';
import { testApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import { insertEnrollment } from '../courses/queries';
import { awardXp } from '../courses/service';
import { clearLeaderboardCache, closeLastWeek, getBadges, getLeaderboard } from './service';

// FR-180, FR-181, FR-184: the weekly board, its cache and the Monday rollover.
// 2026-11-23 is a Monday. All times are in the server zone, here UTC.
const UTC = 'UTC';
const WEEK = '2026-11-23';
const midweek = new Date('2026-11-25T12:00:00Z');

describeWithDb('weekly leaderboard', () => {
  const pool = useTestDatabase();
  beforeEach(clearLeaderboardCache);

  async function learner(username: string, settings: object = {}) {
    const user = await seedUser(pool(), { username, timeZone: UTC });
    await query(pool(), `UPDATE users SET settings = $2 WHERE id = $1`, [
      user.id,
      JSON.stringify(settings),
    ]);
    const [existing] = await query<{ id: number }>(pool(), `SELECT id FROM courses`);
    const courseId = existing?.id ?? (await seedCourse(pool()));
    await insertEnrollment(pool(), user.id, courseId);
    return { userId: user.id, courseId };
  }
  const earn = (who: { userId: number; courseId: number }, times: number, at: string) =>
    Promise.all(
      Array.from({ length: times }, () =>
        awardXp(pool(), { ...who, reason: 'lesson_new', refId: null, at: new Date(at) }),
      ),
    );

  it('ranks opted-in learners by this week XP, with ties sharing a rank', async () => {
    const a = await learner('a');
    const b = await learner('b');
    const c = await learner('c');
    const d = await learner('d');
    await earn(a, 3, '2026-11-24T10:00:00Z');
    await earn(b, 1, '2026-11-24T10:00:00Z');
    await earn(c, 1, '2026-11-25T10:00:00Z');
    await earn(d, 5, '2026-11-22T23:00:00Z'); // last week: not counted
    const board = await getLeaderboard(pool(), midweek, UTC);
    expect(board.weekStart).toBe(WEEK);
    expect(board.entries.map((e) => [e.displayName, e.rank])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
    ]);
  });

  it('leaves out opted-out learners, who can still see the board', async () => {
    const a = await learner('a');
    const hidden = await learner('hidden', { appearOnLeaderboard: false });
    await earn(a, 1, '2026-11-24T10:00:00Z');
    await earn(hidden, 9, '2026-11-24T10:00:00Z');
    const board = await getLeaderboard(pool(), midweek, UTC);
    expect(board.entries.map((e) => e.displayName)).toEqual(['a']);
  });

  it('serves the board and badges to a signed-in opted-out learner only', async () => {
    const { app, close } = await testApp({ pool: pool() });
    try {
      expect((await app.inject({ method: 'GET', url: '/api/v1/leaderboard' })).statusCode).toBe(
        401,
      );
      const user = await seedUser(pool(), {
        username: 'quiet',
        timeZone: UTC,
        passwordHash: await hashPassword('correct horse battery'),
      });
      await query(
        pool(),
        `UPDATE users SET settings = '{"appearOnLeaderboard": false}' WHERE id=$1`,
        [user.id],
      );
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: 'quiet', password: 'correct horse battery' },
      });
      const cookies = {
        [SESSION_COOKIE]: login.cookies.find((c) => c.name === SESSION_COOKIE)!.value,
      };
      const board = await app.inject({ method: 'GET', url: '/api/v1/leaderboard', cookies });
      expect(board.statusCode).toBe(200);
      expect(board.json().entries).toEqual([]);
      const badges = await app.inject({ method: 'GET', url: '/api/v1/me/badges', cookies });
      expect(badges.json()).toEqual({ badges: [] });
    } finally {
      await close();
    }
  });

  it('caches the board for 30 seconds', async () => {
    const a = await learner('a');
    await earn(a, 1, '2026-11-24T10:00:00Z');
    const t0 = new Date('2026-11-25T12:00:00Z');
    expect((await getLeaderboard(pool(), t0, UTC)).entries[0]?.xp).toBe(10);
    await earn(a, 1, '2026-11-25T11:00:00Z');
    const within = new Date(t0.getTime() + 29_000);
    expect((await getLeaderboard(pool(), within, UTC)).entries[0]?.xp).toBe(10);
    const after = new Date(t0.getTime() + 31_000);
    expect((await getLeaderboard(pool(), after, UTC)).entries[0]?.xp).toBe(20);
  });

  it('writes ranks and top-three badges once at the week boundary', async () => {
    const who = [await learner('a'), await learner('b'), await learner('c'), await learner('d')];
    await earn(who[0]!, 4, '2026-11-24T10:00:00Z');
    await earn(who[1]!, 3, '2026-11-26T10:00:00Z');
    await earn(who[2]!, 2, '2026-11-29T23:59:30Z'); // Sunday 23:59, still this week
    await earn(who[3]!, 1, '2026-11-29T23:00:00Z');
    await earn(who[0]!, 9, '2026-11-30T00:00:01Z'); // next week

    const monday = new Date('2026-11-30T00:00:00Z');
    expect(await closeLastWeek(pool(), monday, UTC)).toBe(4);
    expect(await closeLastWeek(pool(), monday, UTC)).toBe(0);
    expect(await closeLastWeek(pool(), new Date('2026-11-30T03:00:00Z'), UTC)).toBe(0);

    const rows = await query(
      pool(),
      `SELECT week_start::text, user_id, rank FROM weekly_results ORDER BY rank`,
    );
    expect(rows.map((r) => [r.week_start, r.rank])).toEqual([
      [WEEK, 1],
      [WEEK, 2],
      [WEEK, 3],
      [WEEK, 4],
    ]);
    expect((await getBadges(pool(), who[0]!.userId)).badges).toEqual([
      { weekStart: WEEK, rank: 1, xp: 40 },
    ]);
    expect((await getBadges(pool(), who[3]!.userId)).badges).toEqual([]);
  });

  it('is a scheduled job for Monday 00:00', () => {
    expect(closeWeekJob.cron).toBe('0 0 * * 1');
  });
});

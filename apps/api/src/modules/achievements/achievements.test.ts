import type { FastifyInstance } from 'fastify';
import type { AchievementList, MetricFamily } from '@manabi/core';
import { query, withTransaction } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import { evaluateAchievements } from './service';

// FR-165 (#71): the achievements engine, one test per metric family at its thresholds, plus the
// seeded definitions and the /me/achievements routes.

describeWithDb('achievements', () => {
  const pool = useTestDatabase();

  const sql = <R extends object = { id: number }>(text: string, params: unknown[] = []) =>
    query<R>(pool(), text, params);

  /** Runs the engine for the given families in its own transaction; returns the unlocked keys. */
  const evaluate = (userId: number, families: MetricFamily[]) =>
    withTransaction(pool(), (client) => evaluateAchievements(client, userId, families)).then(
      (unlocked) => unlocked.map((a) => a.key),
    );

  async function setup() {
    const user = await seedUser(pool());
    const courseId = await seedCourse(pool());
    await sql(`INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2)`, [user.id, courseId]);
    return { userId: user.id, courseId };
  }

  /** `count` items of `type`; returns their ids. */
  async function items(courseId: number, type: string, count: number, from = 1) {
    const rows = await sql(
      `INSERT INTO items (course_id, key, type)
       SELECT $1, 'ja:' || $2 || ':' || n, $2 FROM generate_series($3::int, $4::int) AS n
       RETURNING id`,
      [courseId, type, from, from + count - 1],
    );
    return rows.map((r) => r.id);
  }

  /** Puts items into reviews at `stage`, with the given facets. */
  async function progress(userId: number, itemIds: number[], stage: number, facets = ['meaning']) {
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       SELECT $1, i, f, $3::smallint, CASE WHEN $3 = 8 THEN NULL ELSE now() END
         FROM unnest($2::bigint[]) AS i, unnest($4::text[]) AS f
       ON CONFLICT (user_id, item_id, facet) DO UPDATE SET stage = EXCLUDED.stage,
         due_at = EXCLUDED.due_at`,
      [userId, itemIds, stage, facets],
    );
  }

  it('seeds every Product Spec achievement group as data (Product Spec section 9)', async () => {
    const rows = await sql<{ group_key: string; n: number }>(
      `SELECT group_key, count(*)::int AS n FROM achievements GROUP BY group_key ORDER BY 1`,
    );
    expect(rows).toEqual([
      { group_key: 'course', n: 4 },
      { group_key: 'drawing', n: 1 },
      { group_key: 'effort', n: 3 },
      { group_key: 'grammar', n: 3 },
      { group_key: 'kanji', n: 5 },
      { group_key: 'streak', n: 4 },
      { group_key: 'vocabulary', n: 4 },
    ]);
    expect(
      await sql(`SELECT key FROM achievements WHERE metric = 'streak_days' ORDER BY threshold`),
    ).toEqual([
      { key: 'streak_7' },
      { key: 'streak_30' },
      { key: 'streak_100' },
      { key: 'streak_365' },
    ]);
  });

  it('streak_days: 7, 30, 100 and 365 days, each awarded once', async () => {
    const { userId } = await setup();
    const streak = (n: number) =>
      sql(
        `INSERT INTO user_stats (user_id, current_streak, longest_streak) VALUES ($1, $2, $2)
         ON CONFLICT (user_id) DO UPDATE SET current_streak = $2, longest_streak = $2`,
        [userId, n],
      );
    expect(await evaluate(userId, ['streak_days'])).toEqual([]);
    await streak(6);
    expect(await evaluate(userId, ['streak_days'])).toEqual([]);
    await streak(7);
    expect(await evaluate(userId, ['streak_days'])).toEqual(['streak_7']);
    expect(await evaluate(userId, ['streak_days'])).toEqual([]);
    await streak(29);
    expect(await evaluate(userId, ['streak_days'])).toEqual([]);
    await streak(30);
    expect(await evaluate(userId, ['streak_days'])).toEqual(['streak_30']);
    // A learner who jumps past several thresholds earns them all at once.
    await streak(365);
    expect(await evaluate(userId, ['streak_days'])).toEqual(['streak_100', 'streak_365']);
    expect(await sql(`SELECT count(*)::int AS n FROM user_achievements`)).toEqual([{ n: 4 }]);
  });

  it('only recomputes the metric families it is given', async () => {
    const { userId } = await setup();
    await sql(
      `INSERT INTO user_stats (user_id, current_streak, longest_streak) VALUES ($1, 7, 7)`,
      [userId],
    );
    expect(await evaluate(userId, ['reviews_in_day', 'xp_in_week'])).toEqual([]);
    expect(await evaluate(userId, [])).toEqual([]);
    expect(await evaluate(userId, ['streak_days'])).toEqual(['streak_7']);
  });

  it('familiar_items:kanji: kanji with every facet at stage 4 or above, at 10 and 50', async () => {
    const { userId, courseId } = await setup();
    const kanji = await items(courseId, 'kanji', 50);
    await progress(userId, kanji.slice(0, 9), 4, ['meaning', 'reading']);
    // A word at Familiar and a kanji still Learning do not count.
    await progress(userId, await items(courseId, 'word', 1), 4);
    await progress(userId, kanji.slice(9, 10), 3, ['meaning', 'reading']);
    expect(await evaluate(userId, ['familiar_items'])).toEqual([]);
    // One facet up is not enough; both are.
    await progress(userId, kanji.slice(9, 10), 4, ['meaning']);
    expect(await evaluate(userId, ['familiar_items'])).toEqual([]);
    await progress(userId, kanji.slice(9, 10), 6, ['reading']);
    expect(await evaluate(userId, ['familiar_items'])).toEqual(['kanji_10']);
    await progress(userId, kanji.slice(10, 49), 8);
    expect(await evaluate(userId, ['familiar_items'])).toEqual([]);
    await progress(userId, kanji.slice(49), 5);
    expect(await evaluate(userId, ['familiar_items'])).toEqual(['kanji_50']);
  });

  it('familiar_items:word: 100 words at Familiar', async () => {
    const { userId, courseId } = await setup();
    const words = await items(courseId, 'word', 100);
    await progress(userId, words.slice(0, 99), 4);
    await progress(userId, words.slice(99), 2);
    expect(await evaluate(userId, ['familiar_items'])).toEqual([]);
    await progress(userId, words.slice(99), 4);
    expect(await evaluate(userId, ['familiar_items'])).toEqual(['words_100']);
  });

  it('learned_items:grammar: grammar points in reviews, at 10', async () => {
    const { userId, courseId } = await setup();
    const points = await items(courseId, 'grammar', 10);
    await progress(userId, points.slice(0, 9), 1, ['usage', 'form']);
    expect(await evaluate(userId, ['learned_items'])).toEqual([]);
    await progress(userId, points.slice(9), 1);
    expect(await evaluate(userId, ['learned_items'])).toEqual(['grammar_10']);
  });

  it('section_complete:<level>: every published unit of the section finished', async () => {
    const { userId, courseId } = await setup();
    const [kana] = await sql(
      `INSERT INTO sections (course_id, key, position, title, level_code)
       VALUES ($1, 'ja-en:kana', 0, 'Kana', 'kana') RETURNING id`,
      [courseId],
    );
    const units = await sql(
      `INSERT INTO units (section_id, key, position, title, status)
       VALUES ($1, 'k1', 0, 'k1', 'published'), ($1, 'k2', 1, 'k2', 'published'),
              ($1, 'k3', 2, 'k3', 'draft')
       RETURNING id`,
      [kana!.id],
    );
    const finish = (unitId: number) =>
      sql(`INSERT INTO unit_completions (user_id, unit_id) VALUES ($1, $2)`, [userId, unitId]);
    // An N5 section with no published unit is never complete.
    await sql(
      `INSERT INTO sections (course_id, key, position, title, level_code)
       VALUES ($1, 'ja-en:n5', 1, 'N5', 'N5')`,
      [courseId],
    );
    expect(await evaluate(userId, ['section_complete'])).toEqual([]);
    await finish(units[0]!.id);
    expect(await evaluate(userId, ['section_complete'])).toEqual([]);
    // The draft unit does not count.
    await finish(units[1]!.id);
    expect(await evaluate(userId, ['section_complete'])).toEqual(['section_kana']);
  });

  it('perfect_lessons: the first lesson completed at 100%', async () => {
    const { userId, courseId } = await setup();
    const [section] = await sql(
      `INSERT INTO sections (course_id, key, position, title, level_code)
       VALUES ($1, 's', 0, 'N5', 'N5') RETURNING id`,
      [courseId],
    );
    const [unit] = await sql(
      `INSERT INTO units (section_id, key, position, title) VALUES ($1, 'u', 0, 'u') RETURNING id`,
      [section!.id],
    );
    const [lesson] = await sql(
      `INSERT INTO lessons (unit_id, key, position, type, title)
       VALUES ($1, 'l', 0, 'vocabulary', 'l') RETURNING id`,
      [unit!.id],
    );
    await sql(
      `INSERT INTO lesson_progress (user_id, lesson_id, completed_at, best_accuracy)
       VALUES ($1, $2, now(), 99)`,
      [userId, lesson!.id],
    );
    expect(await evaluate(userId, ['perfect_lessons'])).toEqual([]);
    await sql(`UPDATE lesson_progress SET best_accuracy = 100 WHERE user_id = $1`, [userId]);
    expect(await evaluate(userId, ['perfect_lessons'])).toEqual(['first_perfect_lesson']);
  });

  it("reviews_in_day: 100 answers on the learner's local date", async () => {
    const { userId, courseId } = await setup();
    const [item] = await items(courseId, 'word', 1);
    const log = (n: number, at: string) =>
      sql(
        `INSERT INTO review_log (user_id, item_id, facet, exercise_type, correct, stage_before,
                                 stage_after, answered_at)
         SELECT $1, $2, 'meaning', 'choice', true, 1, 2, ${at} FROM generate_series(1, $3)`,
        [userId, item, n],
      );
    // Yesterday's answers (in Asia/Tokyo, the learner's zone) do not count.
    await log(
      50,
      `((now() AT TIME ZONE 'Asia/Tokyo')::date::timestamp AT TIME ZONE 'Asia/Tokyo') - interval '1 minute'`,
    );
    await log(99, 'now()');
    expect(await evaluate(userId, ['reviews_in_day'])).toEqual([]);
    await log(1, 'now()');
    expect(await evaluate(userId, ['reviews_in_day'])).toEqual(['reviews_100_day']);
  });

  it('xp_in_week: 1,000 XP this week, across courses', async () => {
    const { userId, courseId } = await setup();
    const xp = (amount: number) =>
      sql(
        `INSERT INTO xp_events (user_id, course_id, base_amount, amount, reason, local_date)
         VALUES ($1, $2, $3, $3, 'lesson_new', (now() AT TIME ZONE 'Asia/Tokyo')::date)`,
        [userId, courseId, amount],
      );
    await xp(999);
    expect(await evaluate(userId, ['xp_in_week'])).toEqual([]);
    await xp(1);
    expect(await evaluate(userId, ['xp_in_week'])).toEqual(['xp_1000_week']);
  });

  it('characters_drawn: 100 distinct characters drawn from memory', async () => {
    const { userId, courseId } = await setup();
    const kanji = await items(courseId, 'kanji', 100);
    await sql(`INSERT INTO drawn_characters (user_id, item_id) SELECT $1, unnest($2::bigint[])`, [
      userId,
      kanji.slice(0, 99),
    ]);
    expect(await evaluate(userId, ['characters_drawn'])).toEqual([]);
    await sql(`INSERT INTO drawn_characters (user_id, item_id) VALUES ($1, $2)`, [
      userId,
      kanji[99],
    ]);
    expect(await evaluate(userId, ['characters_drawn'])).toEqual(['drawn_100']);
  });

  it('awards once when two transactions race for the same unlock', async () => {
    const { userId } = await setup();
    await sql(
      `INSERT INTO user_stats (user_id, current_streak, longest_streak) VALUES ($1, 7, 7)`,
      [userId],
    );
    const results = await Promise.all([
      evaluate(userId, ['streak_days']),
      evaluate(userId, ['streak_days']),
    ]);
    expect(results.flat()).toEqual(['streak_7']);
  });

  describe('/me/achievements', () => {
    let current: TestApp | undefined;
    let app: FastifyInstance;
    const PASSWORD = 'correct horse battery';

    beforeEach(async () => {
      current = await testApp({ pool: pool() });
      app = current.app;
    });
    afterEach(async () => {
      await current?.close();
      current = undefined;
    });

    async function signIn(username: string) {
      const user = await seedUser(pool(), { username, passwordHash: await hashPassword(PASSWORD) });
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: username, password: PASSWORD },
      });
      return {
        userId: user.id,
        cookies: { [SESSION_COOKIE]: login.cookies.find((c) => c.name === SESSION_COOKIE)!.value },
        headers: { origin: 'http://localhost:3000' },
      };
    }

    it('lists every achievement and records a celebration as seen once', async () => {
      const aiko = await signIn('aiko');
      const ben = await signIn('ben');
      await sql(
        `INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1, 'streak_7')`,
        [aiko.userId],
      );
      const list = async (who: typeof aiko) => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/me/achievements', ...who });
        expect(res.statusCode).toBe(200);
        return res.json<AchievementList>().achievements;
      };
      const mine = await list(aiko);
      expect(mine).toHaveLength(24);
      expect(mine.find((a) => a.key === 'streak_7')).toMatchObject({
        group: 'streak',
        title: '7-day streak',
        threshold: 7,
        earnedAt: expect.any(String),
        seenAt: null,
      });
      expect(mine.filter((a) => a.earnedAt !== null)).toHaveLength(1);

      const seen = (who: typeof aiko, keys: string[]) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/me/achievements/seen',
          ...who,
          payload: { keys },
        });
      const first = await seen(aiko, ['streak_7', 'streak_30']);
      expect(first.statusCode).toBe(200);
      const seenAt = first
        .json<AchievementList>()
        .achievements.find((a) => a.key === 'streak_7')!.seenAt;
      expect(seenAt).toEqual(expect.any(String));
      // Seeing it again keeps the first time; an unearned key is ignored.
      await seen(aiko, ['streak_7']);
      expect((await list(aiko)).find((a) => a.key === 'streak_7')!.seenAt).toBe(seenAt);
      expect((await list(aiko)).find((a) => a.key === 'streak_30')!.earnedAt).toBeNull();
      // Another learner cannot see or mark someone else's unlock.
      expect((await seen(ben, ['streak_7'])).statusCode).toBe(200);
      expect((await list(ben)).every((a) => a.earnedAt === null)).toBe(true);

      expect((await seen(aiko, [])).statusCode).toBe(400);
      expect((await app.inject({ method: 'GET', url: '/api/v1/me/achievements' })).statusCode).toBe(
        401,
      );
    });
  });
});

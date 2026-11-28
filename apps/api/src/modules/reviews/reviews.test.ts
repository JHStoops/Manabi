import type { FastifyInstance } from 'fastify';
import type {
  LanguagePlugin,
  LessonSession,
  ReviewAnswerResult,
  ReviewSession,
  ReviewSummary,
} from '@manabi/core';
import type * as Core from '@manabi/core';
import type * as LangJa from '@manabi/lang-ja';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import { purgeExpired } from '../retention/service';

// API tests for review entries and review sessions (issue #48): FR-110, FR-112, FR-114, FR-117,
// NFR-02, NFR-20.

// A test language whose review exercises are the test exercise type (answer 'Water'): kanji and
// words have two facets, kana one. The answer 'boom' makes its checker throw, like a plugin bug.
jest.mock('../../plugins', () => {
  const core = jest.requireActual<typeof Core>('@manabi/core');
  const { japanese } = jest.requireActual<typeof LangJa>('@manabi/lang-ja');
  const { testPlugin } = jest.requireActual<{ testPlugin: LanguagePlugin }>(
    '@manabi/core/src/testExerciseType',
  );
  const facets: Record<string, Record<string, string[]>> = {
    kanji: { meaning: ['test_echo'], reading: ['test_echo'] },
    word: { meaning: ['test_echo'], reading: ['test_echo'] },
    kana: { reading: ['test_echo'] },
  };
  const test: LanguagePlugin = {
    ...japanese,
    code: 'test',
    reviewFacets: (type) => facets[type] ?? {},
    checkAnswer: (given, accept, testsKanji) => {
      if (given === 'boom') throw new Error('plugin bug');
      return testPlugin.checkAnswer(given, accept, testsKanji);
    },
  };
  return { languagePlugins: core.createLanguagePluginRegistry([japanese, test]) };
});

const PASSWORD = 'correct horse battery';
const HOUR = 3_600_000;
const RIGHT = { attempts: ['Water'] };
const WRONG = { attempts: ['fire', 'ice'] };

describeWithDb('reviews API', () => {
  const pool = useTestDatabase();
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

  function sql<R extends object = { id: number }>(text: string, params: unknown[] = []) {
    return query<R>(pool(), text, params);
  }

  /** Course 'test' with one unit: lessons for a kana, a kanji and a word, 10 exercises each. */
  async function seed() {
    const [course] = await sql(
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('test-en', 'ja', 'en', 'test', 'Test', 'published') RETURNING id`,
    );
    const courseId = course!.id;
    const items = await sql<{ id: number; type: string }>(
      `INSERT INTO items (course_id, key, type, level_code)
       VALUES ($1, 'kana', 'kana', 'N5'), ($1, 'kanji', 'kanji', 'N5'), ($1, 'word', 'word', 'N5')
       RETURNING id, type`,
      [courseId],
    );
    const item = Object.fromEntries(items.map((i) => [i.type, i.id])) as Record<string, number>;
    const lessons = await sql<{ id: number; type: string }>(
      `WITH s AS (
         INSERT INTO sections (course_id, key, position, title, level_code)
         VALUES ($1, 's', 0, 'N5', 'N5') RETURNING id
       ), u AS (
         INSERT INTO units (section_id, key, position, title, status)
         SELECT id, 'u', 0, 'u', 'published' FROM s RETURNING id
       )
       INSERT INTO lessons (unit_id, key, position, type, title, status)
       SELECT u.id, t.type, t.pos, t.type::text, t.type, 'published'
         FROM u, (VALUES ('kana', 0), ('kanji', 1), ('vocabulary', 2)) AS t (type, pos)
       RETURNING id, type`,
      [courseId],
    );
    const lesson = Object.fromEntries(lessons.map((l) => [l.type, l.id])) as Record<string, number>;
    await sql(
      `INSERT INTO lesson_items (lesson_id, item_id, position)
       VALUES ($1, $2, 0), ($3, $4, 0), ($5, $6, 0)`,
      [lesson.kana, item.kana, lesson.kanji, item.kanji, lesson.vocabulary, item.word],
    );
    await sql(
      `INSERT INTO exercises (lesson_id, type, payload, origin)
       SELECT l.id, 'test_echo', jsonb_build_object('prompt', l.key || n, 'answer', 'Water'),
              'authored'
         FROM lessons l, generate_series(1, 10) AS n`,
    );
    return { courseId, item, lesson };
  }

  /** Signs a learner in and enrolls them; returns their id and the request options. */
  async function learner(username: string, courseId: number) {
    const user = await seedUser(pool(), { username, passwordHash: await hashPassword(PASSWORD) });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: username, password: PASSWORD },
    });
    const session = {
      cookies: { [SESSION_COOKIE]: login.cookies.find((c) => c.name === SESSION_COOKIE)!.value },
      headers: { origin: 'http://localhost:3000' },
    };
    await app.inject({ method: 'POST', url: `/api/v1/courses/${courseId}/enroll`, ...session });
    return { userId: user.id, session };
  }

  async function completeLesson(lessonId: number, session: object) {
    const started = await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${lessonId}/sessions`,
      ...session,
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/lesson-sessions/${started.json<LessonSession>().id}/complete`,
      ...session,
      payload: { responses: Array.from({ length: 10 }, () => RIGHT) },
    });
    expect(response.statusCode).toBe(200);
  }

  const startReviews = (session: object) =>
    app.inject({ method: 'POST', url: '/api/v1/reviews/sessions', ...session });

  const answer = (sessionId: number, session: object, payload: object) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/review-sessions/${sessionId}/answers`,
      ...session,
      payload,
    });

  /** Completes the kana, kanji and vocabulary lessons in path order. */
  async function completeAll(lesson: Record<string, number>, session: object) {
    for (const type of ['kana', 'kanji', 'vocabulary'])
      await completeLesson(lesson[type]!, session);
  }

  /** Makes every facet of the given items due an hour ago, at `stage`. */
  const makeDue = (userId: number, itemIds: number[], stage = 3) =>
    sql(
      `UPDATE item_progress SET stage = $2, due_at = now() - interval '1 hour'
        WHERE user_id = $1 AND item_id = ANY($3::bigint[])`,
      [userId, stage, itemIds],
    );

  const progress = (userId: number) =>
    sql<{ item_id: number; facet: string; stage: number; due_at: Date }>(
      `SELECT item_id, facet, stage, due_at FROM item_progress WHERE user_id = $1
        ORDER BY item_id, facet`,
      [userId],
    );

  it('creates a review entry per facet when a lesson completes; kana start at stage 4 (FR-110)', async () => {
    const { courseId, item, lesson } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    const before = Date.now();
    await completeAll(lesson, session);
    const rows = await progress(userId);
    expect(rows.map((r) => [r.item_id, r.facet, r.stage])).toEqual([
      [item.kana, 'reading', 4],
      [item.kanji, 'meaning', 1],
      [item.kanji, 'reading', 1],
      [item.word, 'meaning', 1],
      [item.word, 'reading', 1],
    ]);
    // Stage 1 is due after 4 hours, stage 4 after a week.
    const dueIn = (r: { due_at: Date }) => (r.due_at.getTime() - before) / HOUR;
    expect(dueIn(rows[0]!)).toBeCloseTo(168, 1);
    expect(dueIn(rows[1]!)).toBeCloseTo(4, 1);

    // A replay keeps the progress made since.
    await sql(`UPDATE item_progress SET stage = 5 WHERE item_id = $1`, [item.word]);
    await completeLesson(lesson.vocabulary!, session);
    expect(
      (await progress(userId)).filter((r) => r.item_id === item.word).map((r) => r.stage),
    ).toEqual([5, 5]);
  });

  it('serves up to 20 items, oldest due first, with an item facets together (FR-114)', async () => {
    const { courseId } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    // 25 due words with one stored exercise each, due 1 to 25 hours ago, plus one not yet due.
    const words = await sql(
      `INSERT INTO items (course_id, key, type, level_code)
       SELECT $1, 'w' || n, 'word', 'N5' FROM generate_series(1, 26) AS n RETURNING id`,
      [courseId],
    );
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       SELECT $1, i.id, f.facet, 2, now() - (i.id - $2 + 1) * interval '1 hour'
         FROM items i, (VALUES ('meaning'), ('reading')) AS f (facet)
        WHERE i.id = ANY($3::bigint[])`,
      [userId, words[0]!.id, words.slice(0, 25).map((w) => w.id)],
    );
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, 'meaning', 2, now() + interval '1 hour')`,
      [userId, words[25]!.id],
    );
    await sql(
      `INSERT INTO exercises (item_id, type, payload, origin)
       SELECT id, 'test_echo', '{"prompt": "p", "answer": "Water"}', 'generated' FROM items`,
    );

    const response = await startReviews(session);
    expect(response.statusCode).toBe(200);
    const { exercises } = response.json<ReviewSession>();
    const order = words
      .slice(0, 25)
      .map((w) => w.id)
      .reverse()
      .slice(0, 20);
    expect(exercises.map((e) => [e.itemId, e.facet])).toEqual(
      order.flatMap((id) => [
        [id, 'meaning'],
        [id, 'reading'],
      ]),
    );
    expect(exercises[0]).toMatchObject({
      type: 'test_echo',
      plugin: 'test',
      correct: null,
      retry: false,
    });
    expect(exercises[0]).not.toHaveProperty('courseId');
    // Starting again resumes the same session.
    expect((await startReviews(session)).json<ReviewSession>().id).toBe(
      response.json<ReviewSession>().id,
    );
  });

  it('skips items with a facet no exercise can be built for, and 409s when nothing is due', async () => {
    const { courseId, item, lesson } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    expect((await startReviews(session)).statusCode).toBe(409);
    await completeAll(lesson, session);
    await makeDue(userId, [item.kanji!]);
    // The kanji lesson's exercises are its pool; once it teaches a second item it has none.
    await sql(`INSERT INTO lesson_items (lesson_id, item_id, position) VALUES ($1, $2, 1)`, [
      lesson.kanji,
      item.word,
    ]);
    expect((await startReviews(session)).statusCode).toBe(409);
  });

  it('moves the whole item once all its facets are answered, and logs every answer (FR-112, FR-117)', async () => {
    const { courseId, item, lesson } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    await completeAll(lesson, session);
    await makeDue(userId, [item.kanji!, item.word!], 5);
    const xpBefore = (await sql<{ n: number }>(`SELECT count(*)::int AS n FROM xp_events`))[0]!.n;
    const started = (await startReviews(session)).json<ReviewSession>();
    const index = (itemId: number, facet: string) =>
      started.exercises.findIndex((e) => e.itemId === itemId && e.facet === facet);

    // The kanji: meaning right, the item does not move yet; reading wrong twice, it drops 2.
    let res = await answer(started.id, session, {
      index: index(item.kanji!, 'meaning'),
      response: RIGHT,
    });
    expect(res.json<ReviewAnswerResult>()).toEqual({
      correct: true,
      stage: null,
      xpEarned: 0,
      retryIndex: null,
      achievements: [],
    });
    res = await answer(started.id, session, {
      index: index(item.kanji!, 'reading'),
      response: WRONG,
    });
    expect(res.json<ReviewAnswerResult>()).toEqual({
      correct: false,
      stage: 3,
      xpEarned: 0,
      retryIndex: 4,
      achievements: [],
    });

    // The word: right on the second try and a near-miss count as right; it moves up with XP.
    await answer(started.id, session, {
      index: index(item.word!, 'meaning'),
      response: { attempts: ['fire', 'Water'] },
    });
    res = await answer(started.id, session, {
      index: index(item.word!, 'reading'),
      response: { attempts: ['water'] },
    });
    expect(res.json<ReviewAnswerResult>()).toEqual({
      correct: true,
      stage: 6,
      xpEarned: 1,
      retryIndex: null,
      achievements: [],
    });

    const rows = await progress(userId);
    expect(rows.map((r) => [r.item_id, r.facet, r.stage])).toEqual([
      [item.kana, 'reading', 4],
      [item.kanji, 'meaning', 3],
      [item.kanji, 'reading', 3],
      [item.word, 'meaning', 6],
      [item.word, 'reading', 6],
    ]);
    expect(rows.every((r) => r.due_at.getTime() > Date.now())).toBe(true);
    expect(
      await sql(
        `SELECT item_id, facet, correct, stage_before, stage_after FROM review_log ORDER BY id`,
      ),
    ).toEqual([
      { item_id: item.kanji, facet: 'meaning', correct: true, stage_before: 5, stage_after: 5 },
      { item_id: item.kanji, facet: 'reading', correct: false, stage_before: 5, stage_after: 3 },
      { item_id: item.word, facet: 'meaning', correct: true, stage_before: 5, stage_after: 5 },
      { item_id: item.word, facet: 'reading', correct: true, stage_before: 5, stage_after: 6 },
    ]);
    // The award points at the review log row of the answer that settled the word.
    const [settled] = await sql(`SELECT id FROM review_log WHERE item_id = $1 ORDER BY id DESC`, [
      item.word,
    ]);
    expect(
      await sql(`SELECT reason, amount, ref_id FROM xp_events ORDER BY id OFFSET $1`, [xpBefore]),
    ).toEqual([{ reason: 'review_correct', amount: 1, ref_id: settled!.id }]);
    // The missed kanji reading is asked again at the end until it is right; retries change no
    // progress and are not logged.
    const retry = (await startReviews(session)).json<ReviewSession>().exercises[4];
    expect(retry).toMatchObject({
      itemId: item.kanji,
      facet: 'reading',
      retry: true,
      correct: null,
    });
    res = await answer(started.id, session, { index: 4, response: WRONG });
    expect(res.json<ReviewAnswerResult>()).toEqual({
      correct: false,
      stage: null,
      xpEarned: 0,
      retryIndex: 5,
      achievements: [],
    });
    res = await answer(started.id, session, { index: 5, response: RIGHT });
    expect(res.json<ReviewAnswerResult>()).toMatchObject({ correct: true, retryIndex: null });
    expect((await progress(userId)).map((r) => r.stage)).toEqual(rows.map((r) => r.stage));
    expect(await sql(`SELECT id FROM review_log`)).toHaveLength(4);
    // A finished session is gone.
    expect(await sql(`SELECT id FROM review_sessions`)).toEqual([]);
    expect((await answer(started.id, session, { index: 0, response: RIGHT })).statusCode).toBe(404);
  });

  it('keeps credit for answered items when the learner stops mid-session (FR-114)', async () => {
    const { courseId, item, lesson } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    await completeAll(lesson, session);
    await makeDue(userId, [item.kana!, item.kanji!], 2);
    const started = (await startReviews(session)).json<ReviewSession>();
    const kana = started.exercises.findIndex((e) => e.itemId === item.kana);
    const kanjiMeaning = started.exercises.findIndex(
      (e) => e.itemId === item.kanji && e.facet === 'meaning',
    );
    await answer(started.id, session, { index: kana, response: RIGHT });
    await answer(started.id, session, { index: kanjiMeaning, response: RIGHT });

    // The kana is settled; the half-answered kanji keeps its stage and stays due.
    const rows = await progress(userId);
    expect(rows.map((r) => [r.item_id, r.stage])).toEqual([
      [item.kana, 3],
      [item.kanji, 2],
      [item.kanji, 2],
      [item.word, 1],
      [item.word, 1],
    ]);
    // Coming back resumes the session with the answers so far, and a repeat is refused.
    const resumed = (await startReviews(session)).json<ReviewSession>();
    expect(resumed.id).toBe(started.id);
    expect(resumed.exercises.map((e) => e.correct)).toEqual(
      started.exercises.map((_, i) => (i === kana || i === kanjiMeaning ? true : null)),
    );
    expect((await answer(started.id, session, { index: kana, response: RIGHT })).statusCode).toBe(
      409,
    );
    // The second attempt is saved with the answer.
    const [state] = await sql<{ state: { exercises: { response?: unknown }[] } }>(
      `SELECT state FROM review_sessions`,
    );
    expect(state!.state.exercises[kana]!.response).toEqual(RIGHT);

    // Once the session expires it is purged, and the next start builds a new one.
    await sql(
      `UPDATE review_sessions SET expires_at = now() - interval '1 second', created_at = now() - interval '1 day'`,
    );
    expect((await purgeExpired(pool())).reviewSessions).toBe(1);
    const next = (await startReviews(session)).json<ReviewSession>();
    expect(next.exercises.map((e) => e.itemId)).toEqual([item.kanji, item.kanji]);
  });

  it('rejects bad answers and leaves nothing behind when a write fails (NFR-20)', async () => {
    const { courseId, item, lesson } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    await completeLesson(lesson.kana!, session);
    await makeDue(userId, [item.kana!]);
    const started = (await startReviews(session)).json<ReviewSession>();

    expect((await answer(started.id, session, { index: 5, response: RIGHT })).statusCode).toBe(400);
    expect(
      (await answer(started.id, session, { index: 0, response: { attempts: ['Water', 'x'] } }))
        .statusCode,
    ).toBe(400);
    expect(
      (await answer(started.id, session, { index: 0, response: { attempts: ['boom'] } }))
        .statusCode,
    ).toBe(500);
    const other = await learner('ben', courseId);
    expect(
      (await answer(started.id, other.session, { index: 0, response: RIGHT })).statusCode,
    ).toBe(404);

    expect(await sql(`SELECT id FROM review_log`)).toEqual([]);
    expect(
      await sql(`SELECT correct_count, wrong_count, stage FROM item_progress WHERE user_id = $1`, [
        userId,
      ]),
    ).toEqual([{ correct_count: 0, wrong_count: 0, stage: 3 }]);
    expect((await startReviews(session)).json<ReviewSession>().exercises[0]!.correct).toBeNull();
  });

  it('summarizes items due now and the next 7 days in the learner time zone (FR-113)', async () => {
    const { courseId, item, lesson } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    await completeAll(lesson, session);
    await sql(`UPDATE item_progress SET due_at = now() - interval '1 hour' WHERE item_id = $1`, [
      item.kanji,
    ]);
    await sql(`UPDATE item_progress SET due_at = now() + interval '2 days' WHERE item_id = $1`, [
      item.word,
    ]);
    // An archived item is never served, so it is not counted either.
    const [archived] = await sql(
      `INSERT INTO items (course_id, key, type, level_code, archived_at)
       VALUES ($1, 'gone', 'word', 'N5', now()) RETURNING id`,
      [courseId],
    );
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at) VALUES
         ($1, $2, 'meaning', 2, now() - interval '1 hour'),
         ($1, $2, 'reading', 2, now() + interval '1 day')`,
      [userId, archived!.id],
    );
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/reviews/summary',
      ...session,
    });
    expect(response.statusCode).toBe(200);
    const summary = response.json<ReviewSummary>();
    const day = (offset: number) =>
      new Date(Date.now() + offset * 24 * HOUR).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Tokyo',
      });
    expect(summary.dueNow).toBe(1);
    expect(summary.forecast.map((d) => d.date)).toEqual([0, 1, 2, 3, 4, 5, 6].map(day));
    // The word is due in 2 days, the kana (stage 4) in 7: outside the window.
    expect(summary.forecast.map((d) => d.count)).toEqual([0, 0, 1, 0, 0, 0, 0]);
  });

  it('pages past due items it cannot serve instead of stalling on them (FR-114)', async () => {
    const { courseId } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    // 150 grammar points the test plugin has no exercise types for, due before one word.
    await sql(
      `INSERT INTO items (course_id, key, type, level_code)
       SELECT $1, 'g' || n, 'grammar', 'N5' FROM generate_series(1, 150) AS n`,
      [courseId],
    );
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       SELECT $1, id, 'usage', 2, now() - interval '2 days' FROM items WHERE type = 'grammar'`,
      [userId],
    );
    const [word] = await sql(
      `INSERT INTO items (course_id, key, type, level_code) VALUES ($1, 'late', 'word', 'N5')
       RETURNING id`,
      [courseId],
    );
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, 'meaning', 2, now() - interval '1 hour')`,
      [userId, word!.id],
    );
    await sql(
      `INSERT INTO exercises (item_id, type, payload, origin)
       VALUES ($1, 'test_echo', '{"prompt": "p", "answer": "Water"}', 'generated')`,
      [word!.id],
    );
    const response = await startReviews(session);
    expect(response.statusCode).toBe(200);
    expect(response.json<ReviewSession>().exercises.map((e) => e.itemId)).toEqual([word!.id]);
  });

  it('builds kana reviews at the level of the section that taught them (FR-141)', async () => {
    // Imported kana have no level of their own; generators need the kana section's level.
    const [course] = await sql(
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('ja-test', 'ja', 'en', 'ja', 'Japanese', 'published') RETURNING id`,
    );
    const [kana] = await sql(
      `INSERT INTO items (course_id, key, type, data)
       VALUES ($1, 'ja:kana:a', 'kana', '{"character": "あ", "script": "hiragana", "romaji": "a"}')
       RETURNING id`,
      [course!.id],
    );
    await sql(
      `WITH s AS (
         INSERT INTO sections (course_id, key, position, title, level_code)
         VALUES ($1, 'kana', 0, 'Kana', 'kana') RETURNING id
       ), u AS (
         INSERT INTO units (section_id, key, position, title, status)
         SELECT id, 'k', 0, 'k', 'published' FROM s RETURNING id
       ), l AS (
         INSERT INTO lessons (unit_id, key, position, type, title, status)
         SELECT id, 'k1', 0, 'kana', 'k1', 'published' FROM u RETURNING id
       )
       INSERT INTO lesson_items (lesson_id, item_id, position) SELECT id, $2, 0 FROM l`,
      [course!.id, kana!.id],
    );
    const { userId, session } = await learner('aiko', course!.id);
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, 'reading', 4, now() - interval '1 hour')`,
      [userId, kana!.id],
    );
    const response = await startReviews(session);
    expect(response.statusCode).toBe(200);
    expect(response.json<ReviewSession>().exercises).toEqual([
      expect.objectContaining({ itemId: kana!.id, facet: 'reading', plugin: 'ja' }),
    ]);
  });

  it('puts a tested-out unit into reviews (FR-110, FR-024)', async () => {
    const { courseId, item } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    const [unit] = await sql(`SELECT id FROM units`);
    const started = await app.inject({
      method: 'POST',
      url: `/api/v1/units/${unit!.id}/test-out`,
      ...session,
    });
    const done = await app.inject({
      method: 'POST',
      url: `/api/v1/test-out-sessions/${started.json<{ id: number }>().id}/complete`,
      ...session,
      payload: { responses: Array.from({ length: 20 }, () => RIGHT) },
    });
    expect(done.statusCode).toBe(200);
    expect((await progress(userId)).map((r) => [r.item_id, r.facet, r.stage])).toEqual([
      [item.kana, 'reading', 4],
      [item.kanji, 'meaning', 1],
      [item.kanji, 'reading', 1],
      [item.word, 'meaning', 1],
      [item.word, 'reading', 1],
    ]);
  });

  it('returns an achievement a review answer unlocks, once (FR-165)', async () => {
    const { courseId, item, lesson } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    await completeAll(lesson, session);
    await makeDue(userId, [item.word!], 5);
    // A 6-day streak that last counted yesterday: today's XP so far (from the lessons) is enough,
    // so the next award counts today and makes it 7.
    await sql(
      `UPDATE user_stats SET current_streak = 6, longest_streak = 6,
              last_active_date = last_active_date - 1
        WHERE user_id = $1`,
      [userId],
    );
    await sql(`DELETE FROM user_achievements WHERE user_id = $1`, [userId]);
    const started = (await startReviews(session)).json<ReviewSession>();
    const index = (facet: string) =>
      started.exercises.findIndex((e) => e.itemId === item.word && e.facet === facet);

    // The first facet settles nothing and awards no XP; the second moves the item up with XP.
    let res = await answer(started.id, session, { index: index('meaning'), response: RIGHT });
    expect(res.json<ReviewAnswerResult>().achievements).toEqual([]);
    res = await answer(started.id, session, { index: index('reading'), response: RIGHT });
    expect(res.json<ReviewAnswerResult>()).toMatchObject({
      xpEarned: 1,
      achievements: [{ key: 'streak_7', group: 'streak', title: '7-day streak', threshold: 7 }],
    });
    expect(
      await sql(`SELECT achievement_key FROM user_achievements WHERE user_id = $1`, [userId]),
    ).toEqual([{ achievement_key: 'streak_7' }]);
  });

  it('starts a session in under a second with 2,000 due items (NFR-02)', async () => {
    const { courseId } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    await sql(
      `INSERT INTO items (course_id, key, type, level_code)
       SELECT $1, 'w' || n, 'word', 'N5' FROM generate_series(1, 2000) AS n`,
      [courseId],
    );
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       SELECT $1, i.id, f.facet, 2, now() - i.id * interval '1 minute'
         FROM items i, (VALUES ('meaning'), ('reading')) AS f (facet) WHERE i.type = 'word'`,
      [userId],
    );
    await sql(
      `INSERT INTO exercises (item_id, type, payload, origin)
       SELECT id, 'test_echo', '{"prompt": "p", "answer": "Water"}', 'generated' FROM items`,
    );
    await sql('ANALYZE');
    const t0 = performance.now();
    const response = await startReviews(session);
    const elapsed = performance.now() - t0;
    expect(response.statusCode).toBe(200);
    expect(response.json<ReviewSession>().exercises).toHaveLength(40);
    expect(elapsed).toBeLessThan(1000);
  });
});

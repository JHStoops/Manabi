import type { FastifyInstance } from 'fastify';
import type { ExerciseGenerator, LanguagePlugin, LessonSession } from '@manabi/core';
import type * as Core from '@manabi/core';
import { payloadItemIds } from '@manabi/core';
import type * as LangJa from '@manabi/lang-ja';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';

// API tests for starting and resuming lesson sessions (issue #29): FR-041, FR-048, FR-050,
// FR-056, NFR-02.

// A test language whose generators name every item they use, so the tests can check FR-048.
jest.mock('../../plugins', () => {
  const core = jest.requireActual<typeof Core>('@manabi/core');
  const { japanese } = jest.requireActual<typeof LangJa>('@manabi/lang-ja');
  const choice: ExerciseGenerator = (item, { taughtItems }) => [
    {
      type: 'choice',
      payload: { prompt: item.key, options: taughtItems.map((i) => ({ itemId: i.id })) },
    },
  ];
  const wordBank: ExerciseGenerator = (item, { sentences }) =>
    sentences
      .filter((s) => s.tokens.some((t) => t.itemId === item.id))
      .map((s) => ({ type: 'word_bank', payload: { sentenceId: s.id, tiles: s.tokens } }));
  const test: LanguagePlugin = {
    ...japanese,
    code: 'test',
    generators: { choice, word_bank: wordBank },
  };
  return { languagePlugins: core.createLanguagePluginRegistry([japanese, test]) };
});

const PASSWORD = 'correct horse battery';

describeWithDb('lesson sessions API', () => {
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

  /** Signs a learner in; returns their id and request options carrying the session cookie. */
  async function signIn(username: string) {
    const user = await seedUser(pool(), { username, passwordHash: await hashPassword(PASSWORD) });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: username, password: PASSWORD },
    });
    const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
    return {
      userId: user.id,
      session: {
        cookies: { [SESSION_COOKIE]: cookie },
        headers: { origin: 'http://localhost:3000' },
      },
    };
  }

  async function sql<R extends object = { id: number }>(text: string, params: unknown[] = []) {
    return query<R>(pool(), text, params);
  }

  /**
   * Course 'test' with an N5 section (unit u1: vocabulary lessons l1, l2 and grammar lesson g)
   * and an N4 section (unit u2: lesson l3). Items: w1 and w2 in l1, w3 in l2, w4 in l3.
   */
  async function seed() {
    const [course] = await sql(
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('test-en', 'ja', 'en', 'test', 'Test', 'published') RETURNING id`,
    );
    const courseId = course!.id;
    const sections = await sql(
      `INSERT INTO sections (course_id, key, position, title, level_code)
       VALUES ($1, 's:n5', 0, 'N5', 'N5'), ($1, 's:n4', 1, 'N4', 'N4') RETURNING id`,
      [courseId],
    );
    const units = await sql(
      `INSERT INTO units (section_id, key, position, title, status)
       VALUES ($1, 'u1', 0, 'u1', 'published'), ($2, 'u2', 0, 'u2', 'published') RETURNING id`,
      [sections[0]!.id, sections[1]!.id],
    );
    const lessons = await sql<{ id: number; key: string }>(
      `INSERT INTO lessons (unit_id, key, position, type, title, status)
       VALUES ($1, 'l1', 0, 'vocabulary', 'l1', 'published'),
              ($1, 'l2', 1, 'vocabulary', 'l2', 'published'),
              ($1, 'g', 2, 'grammar', 'g', 'published'),
              ($2, 'l3', 0, 'vocabulary', 'l3', 'published')
       RETURNING id, key`,
      [units[0]!.id, units[1]!.id],
    );
    const lesson = Object.fromEntries(lessons.map((l) => [l.key, l.id]));
    const items = await sql<{ id: number; key: string }>(
      `INSERT INTO items (course_id, key, type, level_code)
       SELECT $1, 'w' || n, 'word', 'N5' FROM generate_series(1, 4) AS n RETURNING id, key`,
      [courseId],
    );
    const item = Object.fromEntries(items.map((i) => [i.key, i.id]));
    await sql(
      `INSERT INTO lesson_items (lesson_id, item_id, position)
       VALUES ($1, $3, 0), ($1, $4, 1), ($2, $5, 0), ($6, $7, 0)`,
      [lesson.l1, lesson.l2, item.w1, item.w2, item.w3, lesson.l3, item.w4],
    );
    return { courseId, lesson, item };
  }

  /** A sentence linking `itemIds` (one tile each) with the given levels and override. */
  async function sentence(
    courseId: number,
    itemIds: number[],
    levels: { vocab: string | null; grammar: string | null; challenging?: boolean | null },
  ) {
    const tokens = itemIds.map((itemId) => ({ surface: 'x', base: 'x', reading: 'x', itemId }));
    const [row] = await sql(
      `INSERT INTO sentences (course_id, text, tokens, translation, vocab_level_code,
                              grammar_level_code, challenge_override)
       VALUES ($1, 'x', $2, 'x', $3, $4, $5) RETURNING id`,
      [courseId, JSON.stringify(tokens), levels.vocab, levels.grammar, levels.challenging ?? null],
    );
    await sql(`INSERT INTO sentence_items (sentence_id, item_id) SELECT $1, unnest($2::bigint[])`, [
      row!.id,
      itemIds,
    ]);
    return row!.id;
  }

  function complete(userId: number, lessonId: number) {
    return sql(
      `INSERT INTO lesson_progress (user_id, lesson_id, completed_at, best_accuracy)
       VALUES ($1, $2, now(), 100)`,
      [userId, lessonId],
    );
  }

  function start(lessonId: number, session: object) {
    return app.inject({ method: 'POST', url: `/api/v1/lessons/${lessonId}/sessions`, ...session });
  }

  it('builds teaching cards and 10 to 15 exercises from taught items only (FR-041, FR-048)', async () => {
    const { lesson, item } = await seed();
    const { userId, session } = await signIn('aiko');
    await complete(userId, lesson.l1!);
    // Stored exercises: one on taught items is used first, one naming a later item is dropped.
    await sql(
      `INSERT INTO exercises (lesson_id, type, payload, origin)
       VALUES ($1, 'choice', $2, 'authored'), ($1, 'choice', $3, 'authored')`,
      [
        lesson.l2,
        { prompt: 'stored', options: [{ itemId: item.w1 }, { itemId: item.w3 }] },
        { prompt: 'later', options: [{ itemId: item.w3 }, { itemId: item.w4 }] },
      ],
    );

    const t0 = performance.now();
    const response = await start(lesson.l2!, session);
    // NFR-02: under 1 second at the server on the test dataset.
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(response.statusCode).toBe(200);
    const body = response.json<LessonSession>();

    expect(body.teachingCards.map((c) => c.item.id)).toEqual([item.w3]);
    expect(body.exercises.length).toBeGreaterThanOrEqual(10);
    expect(body.exercises.length).toBeLessThanOrEqual(15);
    expect(body.exercises[0]!.payload.prompt).toBe('stored');
    const used = new Set(body.exercises.flatMap((e) => payloadItemIds(e.payload)));
    expect([...used].sort()).toEqual([item.w1, item.w2, item.w3].sort());
  });

  it('uses only sentences at or below the section level and not challenging (FR-056)', async () => {
    const { courseId, lesson, item } = await seed();
    const { userId, session } = await signIn('aiko');
    await complete(userId, lesson.l1!);
    const ok = await sentence(courseId, [item.w3!, item.w1!], { vocab: 'N5', grammar: 'N5' });
    const unlevelled = await sentence(courseId, [item.w3!], { vocab: null, grammar: null });
    await sentence(courseId, [item.w3!], { vocab: 'N5', grammar: 'N4' });
    await sentence(courseId, [item.w3!], { vocab: 'N4', grammar: 'N5' });
    await sentence(courseId, [item.w3!], { vocab: 'N5', grammar: 'N5', challenging: true });
    await sentence(courseId, [item.w3!], { vocab: 'N5', grammar: 'N3' });
    // A sentence with a word from a later lesson (FR-048).
    await sentence(courseId, [item.w3!, item.w4!], { vocab: 'N5', grammar: 'N5' });
    // An author can mark a sentence not challenging, but its levels still apply.
    await sentence(courseId, [item.w3!], { vocab: 'N5', grammar: 'N4', challenging: false });

    const body = (await start(lesson.l2!, session)).json<LessonSession>();
    const sentenceIds = new Set(
      body.exercises.filter((e) => e.type === 'word_bank').map((e) => e.payload.sentenceId),
    );
    expect([...sentenceIds].sort()).toEqual([ok, unlevelled].sort());
  });

  it('resumes the same session for 24 hours, then builds a new one (FR-050)', async () => {
    const { lesson } = await seed();
    const { session } = await signIn('aiko');

    const first = (await start(lesson.l1!, session)).json<LessonSession>();
    const again = (await start(lesson.l1!, session)).json<LessonSession>();
    expect(again).toEqual(first);
    expect(Date.parse(first.expiresAt) - Date.now()).toBeGreaterThan(23.9 * 3600 * 1000);

    // Another learner gets their own session.
    const other = await signIn('ben');
    expect((await start(lesson.l1!, other.session)).json<LessonSession>().id).not.toBe(first.id);

    await sql(
      `UPDATE lesson_sessions SET created_at = now() - interval '25 hours',
                                  expires_at = now() - interval '1 hour'
        WHERE id = $1`,
      [first.id],
    );
    const fresh = (await start(lesson.l1!, session)).json<LessonSession>();
    expect(fresh.id).not.toBe(first.id);
  });

  it('refuses locked, unknown and under-filled lessons', async () => {
    const { lesson } = await seed();
    const { userId, session } = await signIn('aiko');
    expect((await start(lesson.l3!, session)).statusCode).toBe(403);
    expect((await start(999_999, session)).statusCode).toBe(404);
    // Grammar lessons are not generated, and this one has no stored exercises.
    await complete(userId, lesson.l1!);
    await complete(userId, lesson.l2!);
    const response = await start(lesson.g!, session);
    expect(response.statusCode).toBe(409);
    expect(await sql(`SELECT id FROM lesson_sessions`)).toEqual([]);
    expect(
      (await app.inject({ method: 'POST', url: `/api/v1/lessons/1/sessions` })).statusCode,
    ).toBe(401);
  });
});

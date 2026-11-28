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
  // Deterministic: the same `data.variants` (default 9) distinct exercises on every call.
  const choice: ExerciseGenerator = (item, { taughtItems }) =>
    Array.from({ length: Number(item.data.variants ?? 9) }, (_, variant) => ({
      type: 'choice',
      payload: { prompt: item.key, variant, options: taughtItems.map((i) => ({ itemId: i.id })) },
    }));
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

  /**
   * Signs a learner in, enrolled in every course unless `enroll` is false; returns their id and
   * request options carrying the session cookie.
   */
  async function signIn(username: string, enroll = true) {
    const user = await seedUser(pool(), { username, passwordHash: await hashPassword(PASSWORD) });
    if (enroll) {
      await sql(`INSERT INTO enrollments (user_id, course_id) SELECT $1, id FROM courses`, [
        user.id,
      ]);
    }
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

    // #174: the intro and cards need the lesson's title, type, section level and course plugin.
    expect(body).toMatchObject({
      lessonTitle: 'l2',
      lessonType: 'vocabulary',
      sectionLevel: 'N5',
      plugin: 'test',
    });
    expect(body.teachingCards.map((c) => c.item.id)).toEqual([item.w3]);
    expect(body.exercises.length).toBeGreaterThanOrEqual(10);
    expect(body.exercises.length).toBeLessThanOrEqual(15);
    expect(body.exercises[0]!.payload.prompt).toBe('stored');
    const used = new Set(body.exercises.flatMap((e) => payloadItemIds(e.payload)));
    expect([...used].sort()).toEqual([item.w1, item.w2, item.w3].sort());
  });

  it('re-presents earlier items the learner is low on, before their first exercise (FR-041, #256)', async () => {
    const { lesson, item } = await seed();
    const { userId, session } = await signIn('aiko');
    await complete(userId, lesson.l1!);
    // w1 is at a low stage (its lowest facet counts); w2 is past REFRESHER_MAX_STAGE (4).
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, 'meaning', 5, now()), ($1, $2, 'reading', 2, now()),
              ($1, $3, 'meaning', 6, now())`,
      [userId, item.w1, item.w2],
    );
    // The first exercise names only the new item; the generated ones name every taught item.
    await sql(
      `INSERT INTO exercises (lesson_id, type, payload, origin) VALUES ($1, 'choice', $2, 'authored')`,
      [lesson.l2, { prompt: 'stored', options: [{ itemId: item.w3 }] }],
    );

    const response = await start(lesson.l2!, session);
    expect(response.statusCode).toBe(200);
    const body = response.json<LessonSession>();
    expect(body.teachingCards.map((c) => [c.item.id, c.refresher, c.before])).toEqual([
      [item.w3, false, 0],
      [item.w1, true, 1],
    ]);
    expect(payloadItemIds(body.exercises[0]!.payload)).not.toContain(item.w1);
    expect(payloadItemIds(body.exercises[1]!.payload)).toContain(item.w1);

    // A session saved before #256 (no refresher flag) resumes with new-item cards only.
    await sql(
      `UPDATE lesson_sessions
          SET state = jsonb_set(state, '{teachingCards}', (state->'teachingCards') - 1 #- '{0,refresher}')`,
    );
    const resumed = (await start(lesson.l2!, session)).json<LessonSession>();
    expect(resumed.id).toBe(body.id);
    expect(resumed.teachingCards.map((c) => [c.item.id, c.refresher])).toEqual([[item.w3, false]]);
  });

  it('caps refresher cards at the configured density (FR-041, #256)', async () => {
    await current?.close();
    current = await testApp({ pool: pool(), env: { LESSON_CARDS_PER_EXERCISES: '1/5' } });
    app = current.app;
    const { lesson, item } = await seed();
    const { userId, session } = await signIn('aiko');
    await complete(userId, lesson.l1!);
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, 'meaning', 3, now()), ($1, $3, 'meaning', 1, now())`,
      [userId, item.w1, item.w2],
    );
    // The test plugin makes 9 exercises per new item; a stored one fills the session to 10.
    await sql(
      `INSERT INTO exercises (lesson_id, type, payload, origin) VALUES ($1, 'choice', $2, 'authored')`,
      [lesson.l2, { prompt: 'stored', options: [{ itemId: item.w3 }] }],
    );
    const body = (await start(lesson.l2!, session)).json<LessonSession>();
    // 10 exercises allow 2 cards: the new item's, then the lowest-stage earlier item (w2).
    expect(body.exercises).toHaveLength(10);
    expect(body.teachingCards.map((c) => [c.item.id, c.refresher])).toEqual([
      [item.w3, false],
      [item.w2, true],
    ]);
  });

  it('shows no refresher cards with REFRESHER_MAX_STAGE=0 (#256)', async () => {
    await current?.close();
    current = await testApp({ pool: pool(), env: { REFRESHER_MAX_STAGE: '0' } });
    app = current.app;
    const { lesson, item } = await seed();
    const { userId, session } = await signIn('aiko');
    await complete(userId, lesson.l1!);
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, 'meaning', 1, now())`,
      [userId, item.w1],
    );
    await sql(
      `INSERT INTO exercises (lesson_id, type, payload, origin) VALUES ($1, 'choice', $2, 'authored')`,
      [lesson.l2, { prompt: 'stored', options: [{ itemId: item.w3 }] }],
    );
    const body = (await start(lesson.l2!, session)).json<LessonSession>();
    expect(body.teachingCards.map((c) => [c.item.id, c.refresher])).toEqual([[item.w3, false]]);
  });

  it('uses stored exercises in position order and skips archived ones', async () => {
    const { lesson, item } = await seed();
    const { userId, session } = await signIn('aiko');
    await complete(userId, lesson.l1!);
    const payload = (prompt: string) => ({
      prompt,
      options: [{ itemId: item.w1 }, { itemId: item.w2 }],
    });
    await sql(
      `INSERT INTO exercises (lesson_id, key, position, type, payload, origin, archived_at)
       VALUES ($1, 'b', 1, 'choice', $2, 'authored', NULL),
              ($1, 'a', 0, 'choice', $3, 'authored', NULL),
              ($1, 'c', 2, 'choice', $4, 'authored', now())`,
      [lesson.l2, payload('second'), payload('first'), payload('archived')],
    );

    const body = (await start(lesson.l2!, session)).json<LessonSession>();
    const prompts = body.exercises.map((e) => e.payload.prompt);
    expect(prompts.slice(0, 2)).toEqual(['first', 'second']);
    expect(prompts).not.toContain('archived');
  });

  it('swaps drawing exercises for EX-01 when the learner turns drawing off (FR-074)', async () => {
    const { lesson, item } = await seed();
    await sql(`INSERT INTO stroke_data (item_id, strokes) VALUES ($1, '{}')`, [item.w1]);
    await sql(
      `INSERT INTO exercises (lesson_id, item_id, position, type, payload, origin)
       VALUES ($1, $2, 0, 'stroke_trace', $3, 'authored'), ($1, $2, 1, 'draw_memory', $4, 'authored')`,
      [
        lesson.l1,
        item.w1,
        { itemKey: 'w1', character: '一' },
        { itemKey: 'w1', character: '一', prompt: 'Draw "one"' },
      ],
    );
    const types = async (username: string, drawing: boolean) => {
      const { userId, session } = await signIn(username);
      await sql(`UPDATE users SET settings = settings || $2::jsonb WHERE id = $1`, [
        userId,
        { drawingExercises: drawing },
      ]);
      const body = (await start(lesson.l1!, session)).json<LessonSession>();
      return body.exercises.map((e) => `${e.type}:${String(e.payload.prompt)}`);
    };

    const on = await types('aiko', true);
    expect(on.slice(0, 2)).toEqual(['stroke_trace:undefined', 'draw_memory:Draw "one"']);
    const off = await types('bento', false);
    expect(off.some((t) => t.startsWith('stroke_trace') || t.startsWith('draw_memory'))).toBe(
      false,
    );
    // The test plugin's EX-01 for w1 (its prompt is the item key) takes the first place.
    expect(off[0]).toBe('choice:w1');
  });

  it('uses only sentences at or below the section level and not challenging (FR-056)', async () => {
    const { courseId, lesson, item } = await seed();
    const { userId, session } = await signIn('aiko');
    await complete(userId, lesson.l1!);
    await sql(`UPDATE items SET data = '{"variants": 8}' WHERE id = $1`, [item.w3]);
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

  it('gives a new item one fitting example sentence on its teaching card, or none (FR-041)', async () => {
    const { courseId, lesson, item } = await seed();
    const { userId, session } = await signIn('aiko');
    await sql(`UPDATE items SET data = '{"variants": 10}'`);
    // The first sentence is too hard, the second has a word from a later lesson (FR-056, FR-048).
    await sentence(courseId, [item.w3!], { vocab: 'N5', grammar: 'N5', challenging: true });
    await sentence(courseId, [item.w3!, item.w4!], { vocab: 'N5', grammar: 'N5' });
    const fits = await sentence(courseId, [item.w3!, item.w1!], { vocab: 'N5', grammar: 'N5' });
    await sql(`UPDATE sentences SET text = 'mizu', translation = 'water' WHERE id = $1`, [fits]);

    const first = (await start(lesson.l1!, session)).json<LessonSession>();
    expect(first.teachingCards.map((c) => c.examples)).toEqual([[], []]);

    await complete(userId, lesson.l1!);
    const second = (await start(lesson.l2!, session)).json<LessonSession>();
    expect(second.teachingCards[0]!.examples).toMatchObject([
      { text: 'mizu', translation: 'water' },
    ]);
    expect(second.teachingCards[0]!.examples[0]!.tiles).toHaveLength(2);
  });

  it('resumes the same session for 24 hours from the last return, then builds a new one (FR-050)', async () => {
    const { lesson } = await seed();
    const { session } = await signIn('aiko');

    const first = (await start(lesson.l1!, session)).json<LessonSession>();
    expect(Date.parse(first.expiresAt) - Date.now()).toBeGreaterThan(23.9 * 3600 * 1000);
    // Resuming an hour before expiry keeps the session for another 24 hours.
    await sql(`UPDATE lesson_sessions SET expires_at = now() + interval '1 hour' WHERE id = $1`, [
      first.id,
    ]);
    const again = (await start(lesson.l1!, session)).json<LessonSession>();
    expect({ ...again, expiresAt: first.expiresAt }).toEqual(first);
    expect(Date.parse(again.expiresAt) - Date.now()).toBeGreaterThan(23.9 * 3600 * 1000);

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

  it('never repeats an identical exercise, and refuses a lesson left too short', async () => {
    const { lesson, item } = await seed();
    const setVariants = (n: number) =>
      sql(`UPDATE items SET data = jsonb_build_object('variants', $1::int)`, [n]);
    // 5 distinct choice exercises per item, one of them also stored: 10 distinct in all.
    await setVariants(5);
    await sql(
      `INSERT INTO exercises (lesson_id, type, payload, origin) VALUES ($1, 'choice', $2, 'authored')`,
      [
        lesson.l1,
        { prompt: 'w1', variant: 0, options: [{ itemId: item.w1 }, { itemId: item.w2 }] },
      ],
    );
    const aiko = await signIn('aiko');
    const response = await start(lesson.l1!, aiko.session);
    expect(response.statusCode).toBe(200);
    const keys = response
      .json<LessonSession>()
      .exercises.map((e) => JSON.stringify([e.type, e.payload.prompt, e.payload.variant]));
    expect(keys).toHaveLength(10);
    expect(new Set(keys).size).toBe(keys.length);

    // One distinct exercise per item, generated again every round: too few, so nothing is saved.
    await setVariants(1);
    const ben = await signIn('ben');
    expect((await start(lesson.l1!, ben.session)).statusCode).toBe(409);
    expect(await sql(`SELECT id FROM lesson_sessions WHERE user_id = $1`, [ben.userId])).toEqual(
      [],
    );
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

  it('refuses a learner not enrolled in the course (FR-023)', async () => {
    const { lesson } = await seed();
    const { session } = await signIn('aiko', false);
    const response = await start(lesson.l1!, session);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: { code: 'conflict', message: 'Not enrolled in this course', details: null },
    });
    expect(await sql(`SELECT id FROM lesson_sessions`)).toEqual([]);
  });

  it('plays kana and vocabulary lessons generated by the ja plugin end to end (FR-049, FR-141)', async () => {
    // Course 'ja' with a kana section: a kana lesson (あいうえお), then a vocabulary lesson.
    const [course] = await sql(
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('ja-test', 'ja', 'en', 'ja', 'Japanese', 'published') RETURNING id`,
    );
    const [section] = await sql(
      `INSERT INTO sections (course_id, key, position, title, level_code)
       VALUES ($1, 'ja:kana', 0, 'Kana', 'kana') RETURNING id`,
      [course!.id],
    );
    const [unit] = await sql(
      `INSERT INTO units (section_id, key, position, title, status)
       VALUES ($1, 'ja:u1', 0, 'u1', 'published') RETURNING id`,
      [section!.id],
    );
    const [kanaLesson, wordLesson] = await sql(
      `INSERT INTO lessons (unit_id, key, position, type, title, status)
       VALUES ($1, 'ja:k1', 0, 'kana', 'k1', 'published'),
              ($1, 'ja:v1', 1, 'vocabulary', 'v1', 'published') RETURNING id`,
      [unit!.id],
    );
    const kana = [...'あいうえお'].map((character, i) => ({
      type: 'kana',
      level: 'kana',
      data: { character, script: 'hiragana', romaji: 'aiueo'[i] },
    }));
    const words = (
      [
        ['あい', 'love'],
        ['いえ', 'house'],
        ['うえ', 'above'],
        ['あお', 'blue'],
        ['おい', 'nephew'],
      ] as const
    ).map(([written, meaning]) => ({
      type: 'word',
      level: 'N5',
      data: { written, reading: written, senses: [{ partsOfSpeech: [], meanings: [meaning] }] },
    }));
    for (const [lessonId, items] of [
      [kanaLesson!.id, kana],
      [wordLesson!.id, words],
    ] as const) {
      for (const [position, i] of items.entries()) {
        const [row] = await sql(
          `INSERT INTO items (course_id, key, type, level_code, data)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [course!.id, `ja:${lessonId}:${position}`, i.type, i.level, i.data],
        );
        await sql(`INSERT INTO lesson_items (lesson_id, item_id, position) VALUES ($1, $2, $3)`, [
          lessonId,
          row!.id,
          position,
        ]);
      }
    }
    const { session } = await signIn('aiko');

    for (const lessonId of [kanaLesson!.id, wordLesson!.id]) {
      const response = await start(lessonId, session);
      expect(response.statusCode).toBe(200);
      const { id, exercises, teachingCards } = response.json<LessonSession>();
      expect(exercises.length).toBeGreaterThanOrEqual(10);
      // #179: the recipe's types are interleaved, so 5 new kana reach every kana type.
      if (lessonId === kanaLesson!.id) {
        expect(new Set(exercises.map((e) => e.type))).toEqual(
          new Set(['choice', 'typed_answer', 'match_pairs']),
        );
      }
      // #179: every new item is exercised.
      const used = new Set(exercises.flatMap((e) => payloadItemIds(e.payload)));
      expect(teachingCards.filter(({ item }) => !used.has(item.id))).toEqual([]);
      // Answer each exercise right, as the player would.
      const answers = exercises.map((e) => {
        const p = e.payload as { correct?: number; accept?: { text: string }[] };
        if (e.type === 'choice') return p.correct;
        if (e.type === 'match_pairs') return [0, 1, 2, 3, 4];
        return p.accept![0]!.text;
      });
      const done = await app.inject({
        method: 'POST',
        url: `/api/v1/lesson-sessions/${id}/complete`,
        payload: { responses: answers.map((a) => ({ attempts: [a] })) },
        ...session,
      });
      expect(done.statusCode).toBe(200);
      expect(done.json<{ accuracy: number }>().accuracy).toBe(100);
    }
  });
});

import type { FastifyInstance } from 'fastify';
import type {
  ExerciseGenerator,
  ExerciseWrite,
  LanguagePlugin,
  LessonEditor,
  LessonPreview,
} from '@manabi/core';
import type * as Core from '@manabi/core';
import type * as LangJa from '@manabi/lang-ja';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedItems, seedLesson, seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';

// API tests for the lesson editor (issue #43): FR-223, FR-224, FR-237, FR-238.

// Japanese, with a choice generator that makes 9 exercises per item, so a preview has enough.
jest.mock('../../plugins', () => {
  const core = jest.requireActual<typeof Core>('@manabi/core');
  const { japanese } = jest.requireActual<typeof LangJa>('@manabi/lang-ja');
  const choice: ExerciseGenerator = (item) =>
    Array.from({ length: 9 }, (_, variant) => ({
      type: 'choice',
      payload: { prompt: item.key, variant },
    }));
  const ja: LanguagePlugin = { ...japanese, generators: { choice } };
  return { languagePlugins: core.createLanguagePluginRegistry([ja]) };
});

const PASSWORD = 'correct horse battery';

const typedAnswer = (accept: object[]) => ({
  prompt: 'water',
  answerLanguage: 'target',
  accept,
});

describeWithDb('lesson editor API', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;
  let app: FastifyInstance;
  let admin: object;
  let courseId: number;
  let lessonId: number;
  let itemIds: number[];

  beforeEach(async () => {
    current = await testApp({ pool: pool() });
    app = current.app;
    await seedUser(pool(), {
      username: 'admin',
      role: 'admin',
      passwordHash: await hashPassword(PASSWORD),
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'admin', password: PASSWORD },
    });
    admin = {
      cookies: { [SESSION_COOKIE]: login.cookies.find((c) => c.name === SESSION_COOKIE)!.value },
      headers: { origin: 'http://localhost:3000' },
    };
    courseId = await seedCourse(pool());
    ({ lessonId } = await seedLesson(pool(), courseId));
    itemIds = await seedItems(pool(), courseId, 3);
  });

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  function call(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) {
    return app.inject({ method, url: `/api/v1${url}`, payload, ...admin });
  }

  async function ok<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ): Promise<T> {
    const response = await call(method, url, payload);
    expect([response.statusCode, response.statusCode < 300 || response.json()]).toEqual([
      method === 'POST' && url === '/authoring/exercises' ? 201 : 200,
      true,
    ]);
    return response.json<T>();
  }

  const count = async (table: string) =>
    (await query<{ n: number }>(pool(), `SELECT count(*)::int AS n FROM ${table}`))[0]!.n;

  it('sets the new items in order and rejects unknown ones', async () => {
    const editor = await ok<LessonEditor>('PUT', `/authoring/lessons/${lessonId}/items`, {
      itemIds: [itemIds[2], itemIds[0]],
    });
    expect(editor.items.map((i) => i.id)).toEqual([itemIds[2], itemIds[0]]);

    const unknown = await call('PUT', `/authoring/lessons/${lessonId}/items`, {
      itemIds: [999999],
    });
    expect(unknown.statusCode).toBe(400);
  });

  it('rejects a payload its exercise type does not accept, per type', async () => {
    const bad: [string, object][] = [
      ['typed_answer', { prompt: 'water', accept: [{ text: '水' }] }],
      ['choice', { prompt: 'water', options: [{ text: 'a' }], correct: 0 }],
      ['word_bank', { prompt: 'water', answer: { text: '水' }, distractors: 'x' }],
      ['fill_blank', { prompt: 'p', before: 'a', after: 'b', accept: [] }],
    ];
    for (const [type, payload] of bad) {
      const response = await call('POST', '/authoring/exercises', {
        lessonId,
        type,
        origin: 'authored',
        payload,
      });
      expect([type, response.statusCode, response.json().error.code]).toEqual([
        type,
        400,
        'validation_failed',
      ]);
    }
    const unknownType = await call('POST', '/authoring/exercises', {
      lessonId,
      type: 'no_such_type',
      origin: 'authored',
      payload: {},
    });
    expect(unknownType.statusCode).toBe(400);
    expect(await count('exercises')).toBe(0);
  });

  it('stores a pinned exercise with origin pinned and removes it', async () => {
    const payload = {
      prompt: 'water',
      options: ['a', 'b', 'c', 'd'].map((text) => ({ text })),
      correct: 1,
    };
    const { exercise } = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type: 'choice',
      origin: 'pinned',
      payload,
    });
    expect(exercise).toMatchObject({ type: 'choice', origin: 'pinned', payload });
    const [row] = await query<{ origin: string; key: string }>(
      pool(),
      `SELECT origin, key FROM exercises WHERE id = $1`,
      [exercise.id],
    );
    expect(row).toEqual({ origin: 'pinned', key: `ex-${exercise.id}` });

    const editor = await ok<LessonEditor>('DELETE', `/authoring/exercises/${exercise.id}`);
    expect(editor.exercises).toEqual([]);
    expect(await count('exercises')).toBe(0);
  });

  it('segments authored answer text on save and keeps edited tiles', async () => {
    // EX-04 typed answer: the accept list comes without tiles.
    const created = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type: 'typed_answer',
      origin: 'authored',
      payload: typedAnswer([{ text: '水を飲む', tiles: [] }]),
    });
    const tiles = (created.exercise.payload.accept as { tiles: { surface: string }[] }[])[0]!.tiles;
    expect(tiles.map((t) => t.surface)).toEqual(['水', 'を', '飲む']);

    // The author joins two tiles; a re-save keeps them.
    const edited = [{ surface: '水を', base: '水を', reading: 'みずを' }, tiles[2]];
    const id = created.exercise.id;
    const saved = await ok<ExerciseWrite>('PATCH', `/authoring/exercises/${id}`, {
      payload: typedAnswer([{ text: '水を飲む', tiles: edited }]),
    });
    expect(saved.exercise.payload.accept).toEqual([{ text: '水を飲む', tiles: edited }]);

    // Only re-segment replaces them.
    const resegmented = await ok<ExerciseWrite>('PATCH', `/authoring/exercises/${id}`, {
      payload: typedAnswer([{ text: '水を飲む', tiles: edited }]),
      resegment: true,
    });
    expect(resegmented.exercise.payload.accept).toEqual([{ text: '水を飲む', tiles }]);
  });

  it.each([
    ['fill_blank', { prompt: 'I drink water', before: '水', after: '飲む' }, 'を'],
    ['conjugate', { prompt: 'Te-form', word: '飲む' }, '飲んで'],
  ])('segments the accept list of %s', async (type, rest, text) => {
    const { exercise } = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type,
      origin: 'authored',
      payload: { ...rest, accept: [{ text }] },
    });
    const [answer] = exercise.payload.accept as { text: string; tiles: object[] }[];
    expect(answer!.tiles.length).toBeGreaterThan(0);
  });

  it('segments a hand-written word bank answer and accepts its tile order', async () => {
    const { exercise } = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type: 'word_bank',
      origin: 'authored',
      payload: { prompt: 'I drink water', answer: { text: '水を飲む' }, distractors: [] },
    });
    const { answer, acceptedOrders } = exercise.payload as {
      answer: { tiles: { surface: string }[] };
      acceptedOrders: number[][];
    };
    expect(answer.tiles.map((t) => t.surface)).toEqual(['水', 'を', '飲む']);
    expect(acceptedOrders).toEqual([[0, 1, 2]]);
  });

  it('warns about blocked words in answer text', async () => {
    await query(pool(), `INSERT INTO blocked_words (lang, word) VALUES ('ja', '飲む')`);
    const { blockedWords } = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type: 'typed_answer',
      origin: 'authored',
      payload: typedAnswer([{ text: '水を飲んだ' }]),
    });
    expect(blockedWords).toEqual(['飲む']);

    const clean = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type: 'typed_answer',
      origin: 'authored',
      payload: typedAnswer([{ text: '水' }]),
    });
    expect(clean.blockedWords).toEqual([]);
  });

  it('previews a draft lesson without writing progress, sessions or XP', async () => {
    await ok('PUT', `/authoring/lessons/${lessonId}/items`, { itemIds: itemIds.slice(0, 2) });
    const generated = await ok<{ exercises: unknown[] }>(
      'GET',
      `/authoring/lessons/${lessonId}/generated`,
    );
    expect(generated.exercises).toHaveLength(15);

    const preview = await ok<LessonPreview>('POST', `/authoring/lessons/${lessonId}/preview`, {});
    expect(preview).toMatchObject({ lessonId, lessonTitle: 'Lesson 1', plugin: 'ja' });
    expect(preview.teachingCards.map((c) => c.item.id)).toEqual(itemIds.slice(0, 2));
    expect(preview.exercises.length).toBeGreaterThanOrEqual(10);
    for (const table of ['lesson_sessions', 'lesson_progress', 'xp_events', 'enrollments'])
      expect([table, await count(table)]).toEqual([table, 0]);
  });

  it('answers 404 for an unknown lesson or exercise and 403 for a learner', async () => {
    expect((await call('GET', '/authoring/lessons/999999/editor')).statusCode).toBe(404);
    expect((await call('DELETE', '/authoring/exercises/999999')).statusCode).toBe(404);

    await seedUser(pool(), { username: 'learner', passwordHash: await hashPassword(PASSWORD) });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'learner', password: PASSWORD },
    });
    const learner = await app.inject({
      method: 'GET',
      url: `/api/v1/authoring/lessons/${lessonId}/editor`,
      cookies: { [SESSION_COOKIE]: login.cookies.find((c) => c.name === SESSION_COOKIE)!.value },
    });
    expect(learner.statusCode).toBe(403);
  });
});

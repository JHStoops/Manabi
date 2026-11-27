import type { FastifyInstance } from 'fastify';
import type { ExerciseWrite, ItemExercises } from '@manabi/core';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedItems, seedLesson, seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';

// API tests for item-level exercises in authoring (issue #241): FR-229, Product Spec section 11
// (generated exercises can be pinned, edited or removed).

const PASSWORD = 'correct horse battery';

const typed = (accept: string[]) => ({
  prompt: 'Meaning of 水',
  answerLanguage: 'base',
  accept: accept.map((text) => ({ text, tiles: [] })),
});

describeWithDb('item-level exercises in authoring API', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;
  let app: FastifyInstance;
  let admin: object;
  let lessonId: number;
  let itemIds: number[];

  const sql = <R extends object = { id: number }>(text: string, params: unknown[] = []) =>
    query<R>(pool(), text, params);

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
    const courseId = await seedCourse(pool());
    ({ lessonId } = await seedLesson(pool(), courseId));
    itemIds = await seedItems(pool(), courseId, 2);
  });

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  function call(method: 'GET' | 'PATCH' | 'DELETE', url: string, payload?: object) {
    return app.inject({ method, url: `/api/v1${url}`, payload, ...admin });
  }

  async function ok<T>(method: 'GET' | 'PATCH' | 'DELETE', url: string, payload?: object) {
    const response = await call(method, url, payload);
    expect([response.statusCode, response.statusCode < 300 || response.json()]).toEqual([
      200,
      true,
    ]);
    return response.json<T>();
  }

  /** A review pin of `itemId`, as accepting an answer report stores it (FR-229). */
  const pin = async (itemId: number, payload: object = typed(['water', 'aqua'])) =>
    (
      await sql(
        `INSERT INTO exercises (item_id, type, payload, origin)
         VALUES ($1, 'typed_answer', $2, 'pinned') RETURNING id`,
        [itemId, payload],
      )
    )[0]!.id;

  it("lists an item's item-level exercises only, oldest first", async () => {
    const first = await pin(itemIds[0]!);
    const second = await pin(itemIds[0]!, typed(['water']));
    await pin(itemIds[1]!);
    const archived = await pin(itemIds[0]!);
    await sql(`UPDATE exercises SET archived_at = now() WHERE id = $1`, [archived]);
    // A lesson exercise that names the item is not an item-level one.
    await sql(
      `INSERT INTO exercises (lesson_id, item_id, type, payload, origin)
       VALUES ($1, $2, 'typed_answer', $3, 'pinned')`,
      [lessonId, itemIds[0], typed(['x'])],
    );

    const { exercises } = await ok<ItemExercises>(
      'GET',
      `/authoring/items/${itemIds[0]}/exercises`,
    );
    expect(exercises).toEqual([
      {
        id: first,
        type: 'typed_answer',
        origin: 'pinned',
        payload: typed(['water', 'aqua']),
        key: null,
      },
      { id: second, type: 'typed_answer', origin: 'pinned', payload: typed(['water']), key: null },
    ]);
  });

  it('edits an item-level exercise with the payload validated and tiles filled in', async () => {
    const id = await pin(itemIds[0]!);
    const payload = {
      prompt: 'Type water',
      answerLanguage: 'target',
      accept: [{ text: '水を飲む', tiles: [] }],
    };
    const { exercise } = await ok<ExerciseWrite>('PATCH', `/authoring/exercises/${id}`, {
      payload,
    });
    expect(exercise).toMatchObject({ id, type: 'typed_answer', origin: 'pinned' });
    const [answer] = exercise.payload.accept as { tiles: { surface: string }[] }[];
    expect(answer!.tiles.map((t) => t.surface)).toEqual(['水', 'を', '飲む']);
    const [row] = await sql<{ payload: object; item_id: number; lesson_id: number | null }>(
      `SELECT payload, item_id, lesson_id FROM exercises WHERE id = $1`,
      [id],
    );
    expect(row).toEqual({ payload: exercise.payload, item_id: itemIds[0], lesson_id: null });

    const bad = await call('PATCH', `/authoring/exercises/${id}`, { payload: { prompt: 'x' } });
    expect(bad.statusCode).toBe(400);
  });

  it('removes an item-level exercise, or archives it when a report refers to it', async () => {
    const kept = await pin(itemIds[0]!, typed(['water']));
    const removed = await pin(itemIds[0]!);
    const reported = await pin(itemIds[0]!, typed(['water', 'H2O']));
    await sql(
      `INSERT INTO answer_reports (exercise_id, item_id, exercise_type, exercise_payload,
                                   given_answer, status, resolved_at)
       VALUES ($1, $2, 'typed_answer', '{}', 'H2O', 'accepted', now())`,
      [reported, itemIds[0]],
    );

    const afterRemove = await ok<ItemExercises>(
      'DELETE',
      `/authoring/items/${itemIds[0]}/exercises/${removed}`,
    );
    expect(afterRemove.exercises.map((e) => e.id)).toEqual([kept, reported]);
    expect(await sql(`SELECT id FROM exercises WHERE id = $1`, [removed])).toEqual([]);

    const afterArchive = await ok<ItemExercises>(
      'DELETE',
      `/authoring/items/${itemIds[0]}/exercises/${reported}`,
    );
    expect(afterArchive.exercises.map((e) => e.id)).toEqual([kept]);
    const [row] = await sql<{ archived: boolean }>(
      `SELECT archived_at IS NOT NULL AS archived FROM exercises WHERE id = $1`,
      [reported],
    );
    expect(row).toEqual({ archived: true });
  });

  it('answers 404 for another item, a lesson exercise, an unknown item and 403 for a learner', async () => {
    const id = await pin(itemIds[0]!);
    expect(
      (await call('DELETE', `/authoring/items/${itemIds[1]}/exercises/${id}`)).statusCode,
    ).toBe(404);
    const [lessonExercise] = await sql(
      `INSERT INTO exercises (lesson_id, type, payload, origin)
       VALUES ($1, 'typed_answer', $2, 'pinned') RETURNING id`,
      [lessonId, typed(['water'])],
    );
    expect(
      (await call('DELETE', `/authoring/items/${itemIds[0]}/exercises/${lessonExercise!.id}`))
        .statusCode,
    ).toBe(404);
    expect((await call('GET', '/authoring/items/999999/exercises')).statusCode).toBe(404);
    expect(await sql(`SELECT id FROM exercises WHERE id = $1`, [id])).toEqual([{ id }]);

    await seedUser(pool(), { username: 'learner', passwordHash: await hashPassword(PASSWORD) });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'learner', password: PASSWORD },
    });
    const learner = await app.inject({
      method: 'GET',
      url: `/api/v1/authoring/items/${itemIds[0]}/exercises`,
      cookies: { [SESSION_COOKIE]: login.cookies.find((c) => c.name === SESSION_COOKIE)!.value },
    });
    expect(learner.statusCode).toBe(403);
  });
});

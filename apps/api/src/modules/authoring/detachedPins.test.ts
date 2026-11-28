import type { FastifyInstance } from 'fastify';
import type {
  ExerciseWrite,
  GeneratedExercises,
  ItemExercises,
  LessonEditor,
  RetieExercise,
} from '@manabi/core';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedItems, seedLesson, seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';

// API tests for detached pins (issue #259): FR-229, FR-114, SDD section 6. A pin whose recorded
// original the generators still make is not marked; one whose original changed is, and re-tying
// it records what is generated now.

const PASSWORD = 'correct horse battery';

const wordData = (written: string, reading: string, meaning: string) => ({
  written,
  reading,
  senses: [{ partsOfSpeech: ['n'], meanings: [meaning] }],
});
const WORDS = [
  wordData('水', 'みず', 'water'),
  wordData('犬', 'いぬ', 'dog'),
  wordData('猫', 'ねこ', 'cat'),
  wordData('山', 'やま', 'mountain'),
  wordData('川', 'かわ', 'river'),
];

/** EX-04 for 水 as the generator makes it (the term-to-meaning direction). */
const asked = (accept: string[]) => ({
  prompt: 'What does 水 mean?',
  answerLanguage: 'base',
  accept: accept.map((text) => ({ text, tiles: [] })),
});

describeWithDb('detached pins in authoring API', () => {
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
    itemIds = await seedItems(pool(), courseId, WORDS.length);
    for (const [i, data] of WORDS.entries()) {
      await sql(`UPDATE items SET data = $2 WHERE id = $1`, [itemIds[i], data]);
    }
    // Every word is taught in the lesson, so distractors exist for its choice exercises.
    await sql(
      `INSERT INTO lesson_items (lesson_id, item_id, position)
       SELECT $1, id, row_number() OVER (ORDER BY id) - 1 FROM items WHERE id = ANY ($2)`,
      [lessonId, itemIds],
    );
  });

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  function call(method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) {
    return app.inject({ method, url: `/api/v1${url}`, payload, ...admin });
  }

  async function ok<T>(method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) {
    const response = await call(method, url, payload);
    expect([response.statusCode < 300, response.statusCode < 300 || response.json()]).toEqual([
      true,
      true,
    ]);
    return response.json<T>();
  }

  /** A review pin of 水, as accepting an answer report stores it (FR-229, #254). */
  const itemPin = async (original: object = asked([])) =>
    (
      await sql(
        `INSERT INTO exercises (item_id, type, payload, origin, original_payload)
         VALUES ($1, 'typed_answer', $2, 'pinned', $3::jsonb - 'accept') RETURNING id`,
        [itemIds[0], asked(['water', 'aqua']), original],
      )
    )[0]!.id;

  const itemExercises = () =>
    ok<ItemExercises>('GET', `/authoring/items/${itemIds[0]}/exercises`).then((r) => r.exercises);

  it('does not mark an item-level pin whose original is still generated', async () => {
    const id = await itemPin();
    expect(await itemExercises()).toEqual([expect.objectContaining({ id, detached: false })]);
  });

  it('marks an item-level pin once the item data its original came from changes', async () => {
    const id = await itemPin();
    // An author override of the word's written form: the generator now asks about 氷.
    await sql(`UPDATE items SET overrides = $2 WHERE id = $1`, [itemIds[0], { written: '氷' }]);
    expect(await itemExercises()).toEqual([expect.objectContaining({ id, detached: true })]);
  });

  it('marks an item-level pin whose original wording the plugin no longer generates', async () => {
    const id = await itemPin({ ...asked([]), prompt: 'What is the meaning of 水?' });
    expect(await itemExercises()).toEqual([expect.objectContaining({ id, detached: true })]);
  });

  it('re-ties a detached item-level pin, keeping its payload and accept list', async () => {
    const id = await itemPin({ ...asked([]), prompt: 'What is the meaning of 水?' });
    const { exercise } = await ok<RetieExercise>('POST', `/authoring/exercises/${id}/retie`, {});
    expect(exercise).toMatchObject({ id, detached: false, payload: asked(['water', 'aqua']) });
    const [row] = await sql<{ payload: object; original_payload: object }>(
      `SELECT payload, original_payload FROM exercises WHERE id = $1`,
      [id],
    );
    // The closest generated exercise: the same direction and prompt as the pin's payload.
    expect(row).toEqual({
      payload: asked(['water', 'aqua']),
      original_payload: { prompt: 'What does 水 mean?', answerLanguage: 'base' },
    });
    expect(await itemExercises()).toEqual([expect.objectContaining({ id, detached: false })]);
  });

  it('marks lesson pins in the lesson editor and re-ties them', async () => {
    const { exercises: generated } = await ok<GeneratedExercises>(
      'GET',
      `/authoring/lessons/${lessonId}/generated`,
    );
    const made = generated.find((e) => e.type === 'choice')!;
    // Pinned as generated, and once more with an original the generators no longer make.
    const kept = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type: made.type,
      origin: 'pinned',
      payload: made.payload,
    });
    expect(kept.exercise.detached).toBe(false);
    const stale = { ...made.payload, prompt: `${String(made.payload.prompt)} (old wording)` };
    const old = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type: made.type,
      origin: 'pinned',
      payload: made.payload,
      original: stale,
    });
    expect(old.exercise.detached).toBe(true);
    // An authored exercise is never marked.
    const authored = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type: 'typed_answer',
      origin: 'authored',
      payload: asked(['water']),
    });
    expect(authored.exercise.detached).toBe(false);

    const editor = () => ok<LessonEditor>('GET', `/authoring/lessons/${lessonId}/editor`);
    expect((await editor()).exercises.map((e) => [e.id, e.detached])).toEqual([
      [kept.exercise.id, false],
      [old.exercise.id, true],
      [authored.exercise.id, false],
    ]);

    await ok<RetieExercise>('POST', `/authoring/exercises/${old.exercise.id}/retie`, {});
    expect((await editor()).exercises.map((e) => e.detached)).toEqual([false, false, false]);
    // An edit of a re-tied pin keeps it tied: the mark follows its original, not its payload.
    const edited = await ok<ExerciseWrite>('PATCH', `/authoring/exercises/${old.exercise.id}`, {
      payload: { ...made.payload, prompt: 'Pick the meaning' },
    });
    expect(edited.exercise.detached).toBe(false);

    const refused = await call('POST', `/authoring/exercises/${authored.exercise.id}/retie`, {});
    expect(refused.statusCode).toBe(409);
    // A pin still tied keeps its exact original: re-tying it is refused.
    const tied = await call('POST', `/authoring/exercises/${kept.exercise.id}/retie`, {});
    expect(tied.statusCode).toBe(409);
    const [row] = await sql<{ original_payload: object }>(
      `SELECT original_payload FROM exercises WHERE id = $1`,
      [kept.exercise.id],
    );
    expect(row).toEqual({ original_payload: made.payload });
  });

  it('re-ties a lesson pin that names no item to the exercise about the term it asks', async () => {
    // A typed meaning names no item; the lesson teaches five words, 犬 second.
    const stale = { prompt: 'What is the meaning of 犬?', answerLanguage: 'base' };
    const { exercise } = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type: 'typed_answer',
      origin: 'pinned',
      payload: { ...stale, accept: [{ text: 'dog', tiles: [] }] },
    });
    expect(exercise.detached).toBe(true);
    await ok<RetieExercise>('POST', `/authoring/exercises/${exercise.id}/retie`, {});
    const [row] = await sql<{ original_payload: object }>(
      `SELECT original_payload FROM exercises WHERE id = $1`,
      [exercise.id],
    );
    expect(row).toEqual({
      original_payload: { prompt: 'What does 犬 mean?', answerLanguage: 'base' },
    });
  });

  it("re-ties a lesson pin to its own item's exercise when another item's reads alike", async () => {
    // 川 is the lesson's last new item; every word's gloss prompt shares most of its letters.
    const river = itemIds[4]!;
    const tile = { surface: '川', base: '川', reading: 'かわ', itemId: river };
    const { exercise } = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type: 'typed_answer',
      origin: 'pinned',
      payload: {
        prompt: 'Which word is “river”?',
        answerLanguage: 'target',
        accept: [{ text: '川', tiles: [tile] }],
      },
    });
    expect(exercise.detached).toBe(true);
    await ok<RetieExercise>('POST', `/authoring/exercises/${exercise.id}/retie`, {});
    const [row] = await sql<{ original_payload: object }>(
      `SELECT original_payload FROM exercises WHERE id = $1`,
      [exercise.id],
    );
    expect(row).toEqual({
      original_payload: { prompt: 'Which word means “river”?', answerLanguage: 'target' },
    });
  });

  it('answers 409 when the generators make nothing of the pin type', async () => {
    // A word bank needs a sentence, and this lesson has none.
    const { exercise } = await ok<ExerciseWrite>('POST', '/authoring/exercises', {
      lessonId,
      type: 'word_bank',
      origin: 'pinned',
      payload: {
        prompt: 'Water.',
        answer: { text: '水', tiles: [{ surface: '水', base: '水', reading: 'みず' }] },
        distractors: [],
        acceptedOrders: [[0]],
      },
    });
    expect(exercise.detached).toBe(true);
    const response = await call('POST', `/authoring/exercises/${exercise.id}/retie`, {});
    expect(response.statusCode).toBe(409);
  });

  it('answers 404 for an unknown exercise', async () => {
    const response = await call('POST', '/authoring/exercises/999999/retie', {});
    expect(response.statusCode).toBe(404);
  });
});

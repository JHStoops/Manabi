import type { FastifyInstance } from 'fastify';
import { registerExerciseType, z } from '@manabi/core';
import type { LessonSession, ReviewSession } from '@manabi/core';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';

// API tests for grammar lessons (issue #59): FR-091, FR-040, FR-110, Product Spec section 6.

const PASSWORD = 'correct horse battery';
const KEY = 'ja:grammar:te-kudasai';
const choice = (prompt: string) => ({
  prompt,
  options: ['a', 'b', 'c', 'd'].map((text) => ({ text })),
  correct: 0,
});
const fillBlank = (prompt: string) => ({
  prompt,
  before: '見',
  after: 'ください',
  accept: [{ text: 'て', tiles: [] }],
});

describeWithDb('grammar lessons API', () => {
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

  /** A Japanese course whose only lesson is a grammar lesson teaching one grammar point. */
  async function seed() {
    const [course] = await sql(
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('ja-en', 'ja', 'en', 'ja', 'Japanese', 'published') RETURNING id`,
    );
    const courseId = course!.id;
    const [point] = await sql(
      `INSERT INTO items (course_id, key, type, level_code, data)
       VALUES ($1, $2, 'grammar', 'N5', $3) RETURNING id`,
      [
        courseId,
        KEY,
        {
          pattern: 'Verb-te + ください',
          meaning: 'please do',
          formation: [{ wordType: 'Verb', form: 'te-form + ください', example: '見てください' }],
        },
      ],
    );
    const [lesson] = await sql(
      `WITH s AS (
         INSERT INTO sections (course_id, key, position, title, level_code)
         VALUES ($1, 's', 0, 'N5', 'N5') RETURNING id
       ), u AS (
         INSERT INTO units (section_id, key, position, title, status)
         SELECT id, 'u', 0, 'u', 'published' FROM s RETURNING id
       )
       INSERT INTO lessons (unit_id, key, position, type, title, status)
       SELECT id, 'g', 0, 'grammar', 'Please do', 'published' FROM u RETURNING id`,
      [courseId],
    );
    await sql(`INSERT INTO lesson_items (lesson_id, item_id, position) VALUES ($1, $2, 0)`, [
      lesson!.id,
      point!.id,
    ]);
    return { courseId, lessonId: lesson!.id, pointId: point!.id };
  }

  /** Authored exercises of the lesson, at positions in the given order. */
  async function exercises(lessonId: number, rows: [type: string, payload: object][]) {
    for (const [position, [type, payload]] of rows.entries()) {
      await sql(
        `INSERT INTO exercises (lesson_id, key, position, type, payload, origin)
         VALUES ($1, $2, $3, $4, $5, 'authored')`,
        [lessonId, `e${position}`, position, type, payload],
      );
    }
  }

  async function learner(courseId: number) {
    const user = await seedUser(pool(), {
      username: 'aiko',
      passwordHash: await hashPassword(PASSWORD),
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'aiko', password: PASSWORD },
    });
    const session = {
      cookies: { [SESSION_COOKIE]: login.cookies.find((c) => c.name === SESSION_COOKIE)!.value },
      headers: { origin: 'http://localhost:3000' },
    };
    await app.inject({ method: 'POST', url: `/api/v1/courses/${courseId}/enroll`, ...session });
    return { userId: user.id, session };
  }

  const start = (lessonId: number, session: object) =>
    app.inject({ method: 'POST', url: `/api/v1/lessons/${lessonId}/sessions`, ...session });

  it('uses only authored grammar exercises, in Product Spec order (FR-091)', async () => {
    const { courseId, lessonId } = await seed();
    const { session } = await learner(courseId);
    // Authored out of order, with a type grammar lessons do not use and a listening exercise
    // whose type (EX-07) is not registered yet.
    await exercises(lessonId, [
      ['word_bank', { prompt: 'word_bank' }],
      ['listen_choose', { prompt: 'listen_choose' }],
      ['reorder', { prompt: 'reorder' }],
      ['typed_answer', { prompt: 'typed_answer' }],
      ['conjugate', { prompt: 'conjugate' }],
      ['fill_blank', fillBlank('fill_blank')],
      ['choice', choice('choice 1')],
      ['choice', choice('choice 2')],
      ['fill_blank', fillBlank('fill_blank 2')],
      ['reorder', { prompt: 'reorder 2' }],
      ['word_bank', { prompt: 'word_bank 2' }],
      ['choice', choice('choice 3')],
    ]);
    await sql(
      `INSERT INTO exercises (lesson_id, type, payload, origin) VALUES ($1, 'choice', $2, 'pinned')`,
      [lessonId, choice('pinned')],
    );

    const response = await start(lessonId, session);
    expect(response.statusCode).toBe(200);
    expect(response.json<LessonSession>().exercises.map((e) => e.payload.prompt)).toEqual([
      'choice 1',
      'choice 2',
      'choice 3',
      'fill_blank',
      'fill_blank 2',
      'conjugate',
      'reorder',
      'reorder 2',
      'word_bank',
      'word_bank 2',
    ]);
  });

  it('teaches the pattern, meaning, formation table and two examples (Product Spec 6)', async () => {
    const { courseId, lessonId } = await seed();
    const { session } = await learner(courseId);
    await exercises(
      lessonId,
      Array.from({ length: 10 }, (_, i) => ['choice', choice(`c${i}`)] as [string, object]),
    );
    for (const [text, grammar] of [
      ['見てください。', [KEY]],
      ['座ってください。', [KEY]],
      ['来てください。', [KEY]],
      ['見ます。', []],
    ] as const) {
      await sql(
        `INSERT INTO sentences (course_id, text, tokens, translation, grammar, vocab_level_code)
         VALUES ($1, $2, '[]', $3, $4, 'N5')`,
        [courseId, text, `${text} (en)`, JSON.stringify(grammar)],
      );
    }

    const body = (await start(lessonId, session)).json<LessonSession>();
    expect(body.lessonType).toBe('grammar');
    expect(body.teachingCards).toHaveLength(1);
    expect(body.teachingCards[0]!.item.data).toMatchObject({ pattern: 'Verb-te + ください' });
    expect(body.teachingCards[0]!.examples.map((e) => e.text)).toEqual([
      '見てください。',
      '座ってください。',
    ]);
  });

  it('gives the grammar point a review entry served from its exercise pool (FR-110)', async () => {
    const { courseId, lessonId, pointId } = await seed();
    const { userId, session } = await learner(courseId);
    await exercises(lessonId, [
      ...Array.from({ length: 9 }, (_, i) => ['choice', choice(`c${i}`)] as [string, object]),
      ['fill_blank', fillBlank('pool')],
    ]);
    const started = (await start(lessonId, session)).json<LessonSession>();
    const completed = await app.inject({
      method: 'POST',
      url: `/api/v1/lesson-sessions/${started.id}/complete`,
      ...session,
      payload: {
        responses: started.exercises.map((e) => ({
          attempts: [e.type === 'choice' ? 0 : 'て'],
        })),
      },
    });
    expect(completed.statusCode).toBe(200);
    expect(
      await sql(`SELECT item_id AS id, facet, stage FROM item_progress WHERE user_id = $1`, [
        userId,
      ]),
    ).toEqual([{ id: pointId, facet: 'usage', stage: 1 }]);

    await sql(`UPDATE item_progress SET due_at = now() - interval '1 hour'`);
    const reviews = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews/sessions',
      ...session,
    });
    expect(reviews.statusCode).toBe(200);
    expect(reviews.json<ReviewSession>().exercises).toMatchObject([
      { itemId: pointId, facet: 'usage', type: 'fill_blank', payload: { prompt: 'pool' } },
    ]);
  });

  // Last: registering EX-07 stays for the rest of this file.
  it('keeps one listening exercise, last, once EX-07 is registered (FR-091)', async () => {
    registerExerciseType({
      id: 'listen_choose',
      payloadSchema: z.object({ prompt: z.string() }),
      answerSchema: z.number(),
      grade: () => ({ result: 'correct' }),
    });
    const { courseId, lessonId } = await seed();
    const { session } = await learner(courseId);
    await exercises(lessonId, [
      ['listen_choose', { prompt: 'listen 1' }],
      ['listen_choose', { prompt: 'listen 2' }],
      ...Array.from({ length: 15 }, (_, i) => ['choice', choice(`c${i}`)] as [string, object]),
    ]);

    const prompts = (await start(lessonId, session))
      .json<LessonSession>()
      .exercises.map((e) => e.payload.prompt);
    // A full lesson still ends on its one listening exercise.
    expect(prompts).toHaveLength(15);
    expect(prompts.at(-1)).toBe('listen 1');
    expect(prompts.filter((p) => String(p).startsWith('listen'))).toEqual(['listen 1']);
  });
});

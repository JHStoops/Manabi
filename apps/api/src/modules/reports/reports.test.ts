import type { FastifyInstance } from 'fastify';
import type {
  AnswerReport,
  AnswerReportPage,
  ExerciseGenerator,
  LanguagePlugin,
  LessonSession,
  SessionExercise,
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

// API tests for answer reports (issue #63): FR-054, FR-229, Product Spec sections 4 and 11.

// Japanese, with generators that make 3 choices and two typed answers per item: one in Japanese
// whose prompt is the same for every item (only the accept list differs, as for synonyms), and one
// in English that names no item in its payload, as the real generator's English answers do not.
jest.mock('../../plugins', () => {
  const core = jest.requireActual<typeof Core>('@manabi/core');
  const { japanese } = jest.requireActual<typeof LangJa>('@manabi/lang-ja');
  const choice: ExerciseGenerator = (item) =>
    Array.from({ length: 3 }, (_, variant) => ({
      type: 'choice',
      payload: { prompt: item.key, variant },
    }));
  const typed: ExerciseGenerator = (item) => [
    {
      type: 'typed_answer',
      payload: {
        prompt: 'Type the word',
        answerLanguage: 'target',
        accept: [{ text: item.key, tiles: [] }],
      },
    },
    {
      type: 'typed_answer',
      payload: {
        prompt: `Meaning of ${item.key}`,
        answerLanguage: 'base',
        accept: [{ text: 'water', tiles: [] }],
      },
    },
  ];
  const ja: LanguagePlugin = { ...japanese, generators: { choice, typed_answer: typed } };
  return { languagePlugins: core.createLanguagePluginRegistry([ja]) };
});

const PASSWORD = 'correct horse battery';

/** A stored, authored typed answer in the course language. */
const AUTHORED = {
  prompt: 'Type water in Japanese',
  answerLanguage: 'target',
  accept: [{ text: 'みず', tiles: [{ surface: 'みず', base: 'みず', reading: 'みず' }] }],
};

describeWithDb('answer reports API', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;
  let app: FastifyInstance;
  let lessonId: number;
  let itemId: number;
  let authoredId: number;

  type Who = { cookies: Record<string, string>; headers: Record<string, string> };

  async function signIn(username: string, role: 'admin' | 'learner' = 'learner'): Promise<Who> {
    const user = await seedUser(pool(), {
      username,
      role,
      passwordHash: await hashPassword(PASSWORD),
    });
    await sql(`INSERT INTO enrollments (user_id, course_id) SELECT $1, id FROM courses`, [user.id]);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: username, password: PASSWORD },
    });
    const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
    return { cookies: { [SESSION_COOKIE]: cookie }, headers: { origin: 'http://localhost:3000' } };
  }

  async function sql<R extends object = { id: number }>(text: string, params: unknown[] = []) {
    return query<R>(pool(), text, params);
  }

  function call(who: Who, method: 'GET' | 'POST', url: string, payload?: object) {
    return app.inject({ method, url: `/api/v1${url}`, payload, ...who });
  }

  beforeEach(async () => {
    current = await testApp({ pool: pool() });
    app = current.app;
    const [course] = await sql(
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('ja-en', 'ja', 'en', 'ja', 'Japanese', 'published') RETURNING id`,
    );
    const [lesson] = await sql(
      `WITH s AS (
         INSERT INTO sections (course_id, key, position, title, level_code)
         VALUES ($1, 'ja-en:n5', 0, 'N5', 'N5') RETURNING id
       ), u AS (
         INSERT INTO units (section_id, key, position, title, status)
         SELECT id, 'ja-en:n5:u1', 0, 'Unit 1', 'published' FROM s RETURNING id
       )
       INSERT INTO lessons (unit_id, key, position, type, title, status)
       SELECT id, 'ja-en:n5:u1:l1', 0, 'vocabulary', 'Lesson 1', 'published' FROM u
       RETURNING id`,
      [course!.id],
    );
    lessonId = lesson!.id;
    // Two items, so the session (1 stored, then 3 + 2 + 3 + 1 generated) has both typed answers.
    const items = await sql(
      `INSERT INTO items (course_id, key, type, level_code)
       VALUES ($1, 'ja:word:mizu', 'word', 'N5'), ($1, 'ja:word:yama', 'word', 'N5')
       RETURNING id`,
      [course!.id],
    );
    itemId = items[0]!.id;
    await sql(
      `INSERT INTO lesson_items (lesson_id, item_id, position) VALUES ($1, $2, 0), ($1, $3, 1)`,
      [lessonId, itemId, items[1]!.id],
    );
    const [authored] = await sql(
      `INSERT INTO exercises (lesson_id, key, position, type, payload, origin)
       VALUES ($1, 'mizu', 0, 'typed_answer', $2, 'authored') RETURNING id`,
      [lessonId, AUTHORED],
    );
    authoredId = authored!.id;
  });

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  async function startLesson(who: Who): Promise<LessonSession> {
    const response = await call(who, 'POST', `/lessons/${lessonId}/sessions`, {});
    expect(response.statusCode).toBe(200);
    return response.json<LessonSession>();
  }

  const generatedTyped = (session: LessonSession) =>
    session.exercises.find(
      (e) => e.type === 'typed_answer' && e.payload.answerLanguage === 'base',
    )!;

  function report(who: Who, sessionId: number, exercise: SessionExercise, answer: string) {
    return call(who, 'POST', '/answer-reports', {
      session: { kind: 'lesson', id: sessionId },
      exercise: { type: exercise.type, payload: exercise.payload },
      answer,
    });
  }

  async function inbox(who: Who, status = 'open') {
    const response = await call(who, 'GET', `/authoring/reports?status=${status}`);
    expect(response.statusCode).toBe(200);
    return response.json<AnswerReportPage>().items;
  }

  const reportRows = () =>
    sql<{ exercise_id: number | null; item_id: number | null; lesson_id: number | null }>(
      `SELECT exercise_id, item_id, lesson_id FROM answer_reports ORDER BY id`,
    );

  it('files a report on a generated exercise once, from the server copy', async () => {
    const learner = await signIn('learner');
    const session = await startLesson(learner);
    const exercise = generatedTyped(session);
    // Generated questions that differ only in their accept lists are both kept.
    expect(session.exercises.filter((e) => e.payload.prompt === 'Type the word')).toHaveLength(2);

    const filed = await report(learner, session.id, exercise, '  H2O ');
    expect(filed.statusCode).toBe(201);
    expect(filed.json()).toMatchObject({ status: 'open' });
    // Filing it again (a double tap) returns the same report.
    const again = await report(learner, session.id, exercise, 'H2O');
    expect([again.statusCode, again.json().id]).toEqual([200, filed.json().id]);

    // Generated, so no stored exercise; the English answer names no item: the lesson is the target.
    expect(await reportRows()).toEqual([{ exercise_id: null, item_id: null, lesson_id: lessonId }]);
    const [row] = await sql<{ given_answer: string; exercise_payload: object }>(
      `SELECT given_answer, exercise_payload FROM answer_reports`,
    );
    expect(row).toEqual({ given_answer: 'H2O', exercise_payload: exercise.payload });
  });

  it('links a report on a stored exercise to it', async () => {
    const learner = await signIn('learner');
    const session = await startLesson(learner);
    const authored = session.exercises.find((e) => e.payload.prompt === AUTHORED.prompt)!;
    expect((await report(learner, session.id, authored, 'お水')).statusCode).toBe(201);
    expect(await reportRows()).toEqual([
      { exercise_id: authoredId, item_id: null, lesson_id: lessonId },
    ]);
  });

  it('rejects reports that cannot be accepted', async () => {
    const learner = await signIn('learner');
    const other = await signIn('other');
    const session = await startLesson(learner);
    const exercise = generatedTyped(session);
    const choice = session.exercises.find((e) => e.type === 'choice')!;

    // Already accepted, or a near-miss the grader accepts.
    expect((await report(learner, session.id, exercise, 'water')).statusCode).toBe(409);
    expect((await report(learner, session.id, exercise, 'watr')).statusCode).toBe(409);
    // Not an exercise of the session: a made-up payload, or someone else's session.
    const madeUp = { ...exercise, payload: { ...exercise.payload, prompt: 'Something else' } };
    expect((await report(learner, session.id, madeUp, 'H2O')).statusCode).toBe(404);
    expect((await report(other, session.id, exercise, 'H2O')).statusCode).toBe(404);
    // No accept list to add to.
    expect((await report(learner, session.id, choice, 'H2O')).statusCode).toBe(400);
    // Blank and overlong answers.
    expect((await report(learner, session.id, exercise, '   ')).statusCode).toBe(400);
    expect((await report(learner, session.id, exercise, 'x'.repeat(201))).statusCode).toBe(400);
    expect(await reportRows()).toEqual([]);
  });

  it('lets only an admin list and resolve reports', async () => {
    const learner = await signIn('learner');
    const session = await startLesson(learner);
    const filed = (await report(learner, session.id, generatedTyped(session), 'H2O')).json();

    expect((await call(learner, 'GET', '/authoring/reports')).statusCode).toBe(403);
    for (const action of ['accept', 'dismiss']) {
      const response = await call(learner, 'POST', `/authoring/reports/${filed.id}/${action}`, {});
      expect(response.statusCode).toBe(403);
    }
    expect(await sql(`SELECT status FROM answer_reports WHERE id = $1`, [filed.id])).toEqual([
      { status: 'open' },
    ]);
  });

  it('accepts a report on a generated exercise by pinning it with the answer added', async () => {
    const admin = await signIn('admin', 'admin');
    const learner = await signIn('learner');
    const second = await signIn('second');
    const session = await startLesson(learner);
    const exercise = generatedTyped(session);
    const first = (await report(learner, session.id, exercise, 'H2O')).json();
    const secondSession = await startLesson(second);
    const other = (await report(second, secondSession.id, exercise, 'aqua')).json();

    const [open] = await inbox(admin);
    expect(open).toMatchObject({
      id: first.id,
      exerciseType: 'typed_answer',
      givenAnswer: 'H2O',
      exerciseId: null,
      currentAccept: null,
      lessonId,
      courseTitle: 'Japanese',
      plugin: 'ja',
      reporter: 'learner',
      resolvedAt: null,
    });

    const response = await call(admin, 'POST', `/authoring/reports/${first.id}/accept`, {});
    expect(response.statusCode).toBe(200);
    const accepted = response.json<AnswerReport>();
    expect(accepted).toMatchObject({ status: 'accepted', currentAccept: ['water', 'H2O'] });
    expect(accepted.resolvedAt).not.toBeNull();

    // Pinned into the lesson it was played in, with the answer on its accept list (with tiles).
    const pinned = await sql<{ id: number; lesson_id: number; origin: string; payload: never }>(
      `SELECT id, lesson_id, origin, payload FROM exercises WHERE id = $1`,
      [accepted.exerciseId],
    );
    expect(pinned).toEqual([expect.objectContaining({ lesson_id: lessonId, origin: 'pinned' })]);
    const accept = (pinned[0]!.payload as { accept: { text: string; tiles: unknown[] }[] }).accept;
    // An English answer gets no tiles, like the generated ones.
    expect(accept).toEqual([
      { text: 'water', tiles: [] },
      { text: 'H2O', tiles: [] },
    ]);

    // The other open report of the same exercise now points at the pinned one, so accepting it
    // extends that exercise instead of pinning a second copy.
    const [still] = await inbox(admin);
    expect(still).toMatchObject({ id: other.id, exerciseId: accepted.exerciseId });
    expect(
      (await call(admin, 'POST', `/authoring/reports/${other.id}/accept`, {})).json(),
    ).toMatchObject({ status: 'accepted', currentAccept: ['water', 'H2O', 'aqua'] });
    expect(await sql(`SELECT id FROM exercises WHERE origin = 'pinned'`)).toHaveLength(1);

    // A new session plays the pinned copy once, in place of its generated original.
    await sql(`DELETE FROM lesson_sessions`);
    const next = await startLesson(learner);
    const typed = next.exercises.filter((e) => e.payload.prompt === exercise.payload.prompt);
    expect(typed).toHaveLength(1);
    expect((typed[0]!.payload.accept as { text: string }[]).map((a) => a.text)).toEqual([
      'water',
      'H2O',
      'aqua',
    ]);
    expect(await inbox(admin)).toEqual([]);
    expect((await inbox(admin, 'accepted')).map((r) => r.id)).toEqual([first.id, other.id]);
  });

  it('accepts a report on a stored exercise into its accept list', async () => {
    const admin = await signIn('admin', 'admin');
    const learner = await signIn('learner');
    const session = await startLesson(learner);
    const authored = session.exercises.find((e) => e.payload.prompt === AUTHORED.prompt)!;
    const filed = (await report(learner, session.id, authored, 'お水')).json();
    expect((await inbox(admin))[0]).toMatchObject({
      exerciseId: authoredId,
      currentAccept: ['みず'],
    });

    const accepted = (
      await call(admin, 'POST', `/authoring/reports/${filed.id}/accept`, {})
    ).json();
    expect(accepted).toMatchObject({ exerciseId: authoredId, currentAccept: ['みず', 'お水'] });
    const [row] = await sql<{ payload: { accept: { text: string; tiles: object[] }[] } }>(
      `SELECT payload FROM exercises WHERE id = $1`,
      [authoredId],
    );
    // The new answer is segmented into tiles, as the lesson editor does (DR-12).
    expect(row!.payload.accept[1]!.tiles.length).toBeGreaterThan(0);
    expect(await sql(`SELECT id FROM exercises WHERE origin = 'pinned'`)).toEqual([]);
    // Resolved reports cannot be resolved again.
    expect(
      (await call(admin, 'POST', `/authoring/reports/${filed.id}/accept`, {})).statusCode,
    ).toBe(409);
    expect(
      (await call(admin, 'POST', `/authoring/reports/${filed.id}/dismiss`, {})).statusCode,
    ).toBe(409);
    expect((await call(admin, 'POST', `/authoring/reports/999999/accept`, {})).statusCode).toBe(
      404,
    );
  });

  it('dismisses a report and leaves the exercise as it was', async () => {
    const admin = await signIn('admin', 'admin');
    const learner = await signIn('learner');
    const session = await startLesson(learner);
    const authored = session.exercises.find((e) => e.payload.prompt === AUTHORED.prompt)!;
    const filed = (await report(learner, session.id, authored, 'みずみず')).json();

    const response = await call(admin, 'POST', `/authoring/reports/${filed.id}/dismiss`, {});
    expect(response.json()).toMatchObject({ status: 'dismissed', currentAccept: ['みず'] });
    const [row] = await sql<{ payload: object }>(`SELECT payload FROM exercises WHERE id = $1`, [
      authoredId,
    ]);
    expect(row!.payload).toEqual(AUTHORED);
    const [resolved] = await sql<{ resolved_by: number }>(
      `SELECT resolved_by FROM answer_reports WHERE id = $1`,
      [filed.id],
    );
    const [adminRow] = await sql(`SELECT id FROM users WHERE username = 'admin'`);
    expect(resolved!.resolved_by).toBe(adminRow!.id);
    expect(await inbox(admin)).toEqual([]);
    expect((await inbox(admin, 'dismissed')).map((r) => r.id)).toEqual([filed.id]);
  });

  it('links a report from a session built before the author extended the exercise', async () => {
    const learner = await signIn('learner');
    const session = await startLesson(learner);
    const authored = session.exercises.find((e) => e.payload.prompt === AUTHORED.prompt)!;
    await sql(`UPDATE exercises SET payload = $2 WHERE id = $1`, [
      authoredId,
      { ...AUTHORED, accept: [...AUTHORED.accept, { text: '水', tiles: [] }] },
    ]);
    expect((await report(learner, session.id, authored, 'お水')).statusCode).toBe(201);
    expect(await reportRows()).toEqual([
      { exercise_id: authoredId, item_id: null, lesson_id: lessonId },
    ]);
  });

  it('pins one copy when two reports of a generated exercise are accepted at once', async () => {
    const admin = await signIn('admin', 'admin');
    const learner = await signIn('learner');
    const second = await signIn('second');
    const session = await startLesson(learner);
    const exercise = generatedTyped(session);
    const first = (await report(learner, session.id, exercise, 'H2O')).json();
    const other = (await report(second, (await startLesson(second)).id, exercise, 'aqua')).json();
    // Not yet linked: the race is between two pins.
    await sql(`UPDATE answer_reports SET exercise_id = NULL`);

    const responses = await Promise.all(
      [first.id, other.id].map((id) => call(admin, 'POST', `/authoring/reports/${id}/accept`, {})),
    );
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200]);
    const pins = await sql<{ payload: { accept: { text: string }[] } }>(
      `SELECT payload FROM exercises WHERE origin = 'pinned'`,
    );
    expect(pins).toHaveLength(1);
    expect(pins[0]!.payload.accept.map((a) => a.text).sort()).toEqual(['H2O', 'aqua', 'water']);
  });

  it('does not add an answer the grader already takes', async () => {
    const admin = await signIn('admin', 'admin');
    const learner = await signIn('learner');
    const second = await signIn('second');
    const session = await startLesson(learner);
    const exercise = generatedTyped(session);
    const first = (await report(learner, session.id, exercise, 'H2O')).json();
    const other = (await report(second, (await startLesson(second)).id, exercise, 'h2o')).json();
    await call(admin, 'POST', `/authoring/reports/${first.id}/accept`, {});
    const accepted = (
      await call(admin, 'POST', `/authoring/reports/${other.id}/accept`, {})
    ).json<AnswerReport>();
    expect(accepted).toMatchObject({ status: 'accepted', currentAccept: ['water', 'H2O'] });
  });

  it('keeps a review pin and a lesson pin of the same question apart', async () => {
    const admin = await signIn('admin', 'admin');
    const learner = await signIn('learner');
    const session = await startLesson(learner);
    const exercise = generatedTyped(session);
    const lessonReport = (await report(learner, session.id, exercise, 'H2O')).json();
    const reviewReport = await reviewReportOf(learner, exercise, 'aqua');

    // Accepting the review report pins at item level and leaves the lesson report alone.
    await call(admin, 'POST', `/authoring/reports/${reviewReport}/accept`, {});
    expect(await reportRows()).toEqual([
      { exercise_id: null, item_id: null, lesson_id: lessonId },
      { exercise_id: expect.any(Number), item_id: itemId, lesson_id: null },
    ]);
    const lessonAccepted = (
      await call(admin, 'POST', `/authoring/reports/${lessonReport.id}/accept`, {})
    ).json<AnswerReport>();
    expect(lessonAccepted.currentAccept).toEqual(['water', 'H2O']);
    expect(
      await sql(
        `SELECT lesson_id, item_id FROM exercises WHERE origin = 'pinned' ORDER BY lesson_id`,
      ),
    ).toEqual([
      { lesson_id: lessonId, item_id: null },
      { lesson_id: null, item_id: itemId },
    ]);
  });

  /** Files a report from a review session holding `exercise` for the first item; its id. */
  async function reviewReportOf(who: Who, exercise: SessionExercise, answer: string) {
    const [user] = await sql(`SELECT id FROM users WHERE username = 'learner'`);
    const [course] = await sql(`SELECT id FROM courses`);
    const [session] = await sql(
      `INSERT INTO review_sessions (user_id, state, expires_at)
       VALUES ($1, $2, now() + interval '1 day') RETURNING id`,
      [
        user!.id,
        {
          exercises: [
            {
              type: exercise.type,
              payload: exercise.payload,
              itemId,
              facet: 'meaning',
              plugin: 'ja',
              courseId: course!.id,
              correct: null,
              retry: false,
            },
          ],
        },
      ],
    );
    const filed = await call(who, 'POST', '/answer-reports', {
      session: { kind: 'review', id: session!.id },
      exercise: { type: exercise.type, payload: exercise.payload },
      answer,
    });
    expect(filed.statusCode).toBe(201);
    return filed.json<{ id: number }>().id;
  }

  it('pins a reported review exercise at item level when accepted', async () => {
    const admin = await signIn('admin', 'admin');
    const learner = await signIn('learner');
    const [user] = await sql(`SELECT id FROM users WHERE username = 'learner'`);
    const [course] = await sql(`SELECT id FROM courses`);
    const exercise = {
      type: 'typed_answer',
      payload: {
        prompt: 'Meaning of mizu',
        answerLanguage: 'base',
        accept: [{ text: 'water', tiles: [] }],
      },
    };
    const [session] = await sql(
      `INSERT INTO review_sessions (user_id, state, expires_at)
       VALUES ($1, $2, now() + interval '1 day') RETURNING id`,
      [
        user!.id,
        {
          exercises: [
            {
              ...exercise,
              itemId,
              facet: 'meaning',
              plugin: 'ja',
              courseId: course!.id,
              correct: null,
              retry: false,
            },
          ],
        },
      ],
    );
    const filed = await call(learner, 'POST', '/answer-reports', {
      session: { kind: 'review', id: session!.id },
      exercise,
      answer: 'H2O',
    });
    expect(filed.statusCode).toBe(201);
    expect(await reportRows()).toEqual([{ exercise_id: null, item_id: itemId, lesson_id: null }]);

    const accepted = (
      await call(admin, 'POST', `/authoring/reports/${filed.json().id}/accept`, {})
    ).json<AnswerReport>();
    expect(accepted.currentAccept).toEqual(['water', 'H2O']);
    expect(
      await sql(`SELECT item_id, lesson_id, origin FROM exercises WHERE id = $1`, [
        accepted.exerciseId,
      ]),
    ).toEqual([{ item_id: itemId, lesson_id: null, origin: 'pinned' }]);
  });
});

import type { FastifyInstance } from 'fastify';
import type { LanguagePlugin, LessonCompletion, LessonSession } from '@manabi/core';
import type * as Core from '@manabi/core';
import type * as LangJa from '@manabi/lang-ja';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import * as queries from './queries';

// API tests for completing a lesson session (issue #37): FR-051, FR-052, FR-053, NFR-14, NFR-20.

// A test language graded by the test exercise type (exact match right, wrong case a near-miss);
// the answer 'boom' makes its checker throw, like a plugin bug.
jest.mock('../../plugins', () => {
  const core = jest.requireActual<typeof Core>('@manabi/core');
  const { japanese } = jest.requireActual<typeof LangJa>('@manabi/lang-ja');
  const { testPlugin } = jest.requireActual<{ testPlugin: LanguagePlugin }>(
    '@manabi/core/src/testExerciseType',
  );
  const test: LanguagePlugin = {
    ...japanese,
    code: 'test',
    checkAnswer: (given, exercise) => {
      if (given === 'boom') throw new Error('plugin bug');
      return testPlugin.checkAnswer(given, exercise);
    },
  };
  return { languagePlugins: core.createLanguagePluginRegistry([japanese, test]) };
});

const PASSWORD = 'correct horse battery';
const EXERCISES = 10;

describeWithDb('lesson completion API', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;
  let app: FastifyInstance;

  beforeEach(async () => {
    current = await testApp({ pool: pool() });
    app = current.app;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await current?.close();
    current = undefined;
  });

  async function sql<R extends object = { id: number }>(text: string, params: unknown[] = []) {
    return query<R>(pool(), text, params);
  }

  /**
   * Course 'test' with unit u1 (grammar lessons a, b) and unit u2 (lesson c). Each lesson has 10
   * stored test exercises whose answer is 'Water'.
   */
  async function seed() {
    const [course] = await sql(
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('test-en', 'ja', 'en', 'test', 'Test', 'published') RETURNING id`,
    );
    const [section] = await sql(
      `INSERT INTO sections (course_id, key, position, title, level_code)
       VALUES ($1, 's', 0, 'N5', 'N5') RETURNING id`,
      [course!.id],
    );
    const units = await sql(
      `INSERT INTO units (section_id, key, position, title, status)
       VALUES ($1, 'u1', 0, 'u1', 'published'), ($1, 'u2', 1, 'u2', 'published') RETURNING id`,
      [section!.id],
    );
    const lessons = await sql<{ id: number; key: string }>(
      `INSERT INTO lessons (unit_id, key, position, type, title, status)
       VALUES ($1, 'a', 0, 'grammar', 'a', 'published'), ($1, 'b', 1, 'grammar', 'b', 'published'),
              ($2, 'c', 0, 'grammar', 'c', 'published')
       RETURNING id, key`,
      [units[0]!.id, units[1]!.id],
    );
    await sql(
      `INSERT INTO exercises (lesson_id, type, payload, origin)
       SELECT l.id, 'test_echo', jsonb_build_object('prompt', 'p' || n, 'answer', 'Water'),
              'authored'
         FROM lessons l, generate_series(1, $1) AS n`,
      [EXERCISES],
    );
    return { courseId: course!.id, lesson: Object.fromEntries(lessons.map((l) => [l.key, l.id])) };
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

  async function start(lessonId: number, session: object) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${lessonId}/sessions`,
      ...session,
    });
    return response.json<LessonSession>().id;
  }

  /** Responses with the first `right` exercises answered right and the rest wrong twice. */
  function responses(right = EXERCISES, extra: object = {}): object[] {
    return Array.from({ length: EXERCISES }, (_, i) => ({
      attempts: i < right ? ['Water'] : ['fire', 'ice'],
      ...extra,
    }));
  }

  function complete(
    sessionId: number,
    learnerSession: { cookies: object; headers: object },
    payload: object,
    key?: string,
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/lesson-sessions/${sessionId}/complete`,
      cookies: learnerSession.cookies as Record<string, string>,
      headers: { ...learnerSession.headers, ...(key ? { 'idempotency-key': key } : {}) },
      payload,
    });
  }

  const counts = () =>
    sql<{ progress: number; xp: number; items: number; keys: number; sessions: number }>(
      `SELECT (SELECT count(*)::int FROM lesson_progress) AS progress,
              (SELECT count(*)::int FROM xp_events) AS xp,
              (SELECT count(*)::int FROM item_progress) AS items,
              (SELECT count(*)::int FROM idempotency_keys) AS keys,
              (SELECT count(*)::int FROM lesson_sessions) AS sessions`,
    ).then((rows) => rows[0]);

  it('re-grades responses, ignoring client correctness, and records the completion (FR-051, FR-053)', async () => {
    const { courseId, lesson } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    const sessionId = await start(lesson.a!, session);

    // 7 right first time, 1 right on the second attempt, 1 near-miss, 1 wrong twice; every
    // response claims to be correct.
    const tampered = responses(7, { correct: true });
    tampered[7] = { attempts: ['fire', 'Water'], correct: true };
    tampered[8] = { attempts: ['water'], correct: true };
    const response = await complete(sessionId, session, { responses: tampered, accuracy: 100 });
    expect(response.statusCode).toBe(200);
    const body = response.json<LessonCompletion>();
    expect(body).toMatchObject({ lessonId: lesson.a, accuracy: 90, xpEarned: 15, totalXp: 15 });
    expect(body.path.sections[0]!.units[0]!.lessons.map((l) => l.state)).toEqual([
      'completed',
      'available',
    ]);
    expect(
      await sql(`SELECT best_accuracy, times_completed FROM lesson_progress WHERE user_id = $1`, [
        userId,
      ]),
    ).toEqual([{ best_accuracy: 90, times_completed: 1 }]);
    // The session is used up.
    expect((await complete(sessionId, session, { responses: responses() })).statusCode).toBe(404);

    // Finishing lesson b finishes unit u1 and unlocks u2; a replay of a earns replay XP and keeps
    // its best accuracy.
    const done = await complete(await start(lesson.b!, session), session, {
      responses: responses(5),
    });
    expect(done.json<LessonCompletion>()).toMatchObject({ accuracy: 50, xpEarned: 10 });
    expect(done.json<LessonCompletion>().path.sections[0]!.units[1]!.lessons[0]!.state).toBe(
      'available',
    );
    expect(await sql(`SELECT unit_id AS id FROM unit_completions`)).toHaveLength(1);
    const replay = await complete(await start(lesson.a!, session), session, {
      responses: responses(0),
    });
    expect(replay.json<LessonCompletion>()).toMatchObject({ accuracy: 0, xpEarned: 5 });
    expect(
      await sql(`SELECT best_accuracy, times_completed FROM lesson_progress WHERE lesson_id = $1`, [
        lesson.a,
      ]),
    ).toEqual([{ best_accuracy: 90, times_completed: 2 }]);
  });

  it('applies a repeated Idempotency-Key once and replays the first response (FR-052)', async () => {
    const { courseId, lesson } = await seed();
    const { session } = await learner('aiko', courseId);
    const sessionId = await start(lesson.a!, session);

    const first = await complete(sessionId, session, { responses: responses() }, 'key-1');
    const again = await complete(sessionId, session, { responses: responses() }, 'key-1');
    expect(first.statusCode).toBe(200);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first.json());
    expect(await counts()).toEqual({ progress: 1, xp: 2, items: 0, keys: 1, sessions: 0 });

    // The same key on a different request is refused.
    const other = await complete(sessionId, session, { responses: responses(3) }, 'key-1');
    expect(other.statusCode).toBe(409);
    expect(other.json()).toMatchObject({ error: { code: 'idempotency_conflict' } });

    // Keys are per learner: another learner's same key is their own.
    const ben = await learner('ben', courseId);
    const bens = await complete(
      await start(lesson.a!, ben.session),
      ben.session,
      { responses: responses() },
      'key-1',
    );
    expect(bens.statusCode).toBe(200);
    expect(await counts()).toMatchObject({ progress: 2, keys: 2 });
  });

  it('completes a session once when two different keys race (FR-051, FR-052)', async () => {
    const { courseId, lesson } = await seed();
    const { session } = await learner('aiko', courseId);
    const sessionId = await start(lesson.a!, session);

    const statuses = await Promise.all(
      ['key-1', 'key-2'].map((key) =>
        complete(sessionId, session, { responses: responses() }, key).then((r) => r.statusCode),
      ),
    );
    expect(statuses.sort()).toEqual([200, 404]);
    expect(await counts()).toEqual({ progress: 1, xp: 2, items: 0, keys: 1, sessions: 0 });
  });

  it('leaves no partial state when the transaction fails part way (NFR-20)', async () => {
    const { courseId, lesson } = await seed();
    const { session } = await learner('aiko', courseId);
    const sessionId = await start(lesson.a!, session);

    // Fails after lesson progress, XP and the unit check have been written.
    jest.spyOn(queries, 'deleteSession').mockRejectedValueOnce(new Error('injected failure'));
    const failed = await complete(sessionId, session, { responses: responses() }, 'key-1');
    expect(failed.statusCode).toBe(500);
    expect(await counts()).toEqual({ progress: 0, xp: 0, items: 0, keys: 0, sessions: 1 });
    expect(await sql(`SELECT total_xp AS id FROM enrollments`)).toEqual([{ id: 0 }]);

    // The retry with the same key then applies normally.
    const retried = await complete(sessionId, session, { responses: responses() }, 'key-1');
    expect(retried.statusCode).toBe(200);
    expect(await counts()).toEqual({ progress: 1, xp: 2, items: 0, keys: 1, sessions: 0 });
  });

  it("refuses another learner's session and malformed responses, and completes an expired one (NFR-14)", async () => {
    const { courseId, lesson } = await seed();
    const aiko = await learner('aiko', courseId);
    const ben = await learner('ben', courseId);
    const sessionId = await start(lesson.a!, aiko.session);

    const stolen = await complete(sessionId, ben.session, { responses: responses() });
    expect(stolen.statusCode).toBe(404);
    // Expired, but its row is still there: completion only needs the session to exist.
    await sql(
      `UPDATE lesson_sessions SET created_at = now() - interval '25 hours',
                                  expires_at = now() - interval '1 hour'`,
    );
    expect((await complete(sessionId, ben.session, { responses: responses() })).statusCode).toBe(
      404,
    );

    const short = await complete(sessionId, aiko.session, { responses: responses().slice(1) });
    expect(short.statusCode).toBe(400);
    // A second attempt after a right first one is not a valid response.
    const invalid = responses();
    invalid[0] = { attempts: ['Water', 'Water'] };
    expect((await complete(sessionId, aiko.session, { responses: invalid })).statusCode).toBe(400);
    const badKey = await complete(sessionId, aiko.session, { responses: responses() }, 'a b');
    expect(badKey.statusCode).toBe(400);
    expect(await counts()).toEqual({ progress: 0, xp: 0, items: 0, keys: 0, sessions: 1 });
    // Any other grader or plugin error is a server fault, not the learner's.
    const buggy = responses();
    buggy[0] = { attempts: ['boom'] };
    expect((await complete(sessionId, aiko.session, { responses: buggy })).statusCode).toBe(500);
    expect((await complete(sessionId, aiko.session, { responses: responses() })).statusCode).toBe(
      200,
    );

    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/lesson-sessions/${sessionId}/complete`,
          payload: { responses: responses() },
        })
      ).statusCode,
    ).toBe(401);
  });
});

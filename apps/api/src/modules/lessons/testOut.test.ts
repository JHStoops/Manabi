import type { FastifyInstance } from 'fastify';
import type { LanguagePlugin, TestOutCompletion, TestOutSession } from '@manabi/core';
import type * as Core from '@manabi/core';
import type * as LangJa from '@manabi/lang-ja';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';

// API tests for the unit test-out (issue #96): FR-024, FR-021, FR-052.

// A test language graded by the test exercise type (exact match right).
jest.mock('../../plugins', () => {
  const core = jest.requireActual<typeof Core>('@manabi/core');
  const { japanese } = jest.requireActual<typeof LangJa>('@manabi/lang-ja');
  const { testPlugin } = jest.requireActual<{ testPlugin: LanguagePlugin }>(
    '@manabi/core/src/testExerciseType',
  );
  const test: LanguagePlugin = { ...japanese, code: 'test', checkAnswer: testPlugin.checkAnswer };
  return { languagePlugins: core.createLanguagePluginRegistry([japanese, test]) };
});

const PASSWORD = 'correct horse battery';
const EXERCISES = 20;

describeWithDb('unit test-out API', () => {
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

  async function sql<R extends object = { id: number }>(text: string, params: unknown[] = []) {
    return query<R>(pool(), text, params);
  }

  /**
   * Course 'test' with unit u1 (unit review lessons a, b) and unit u2 (lesson c). Each lesson has 10
   * stored test exercises whose answer is 'Water', so u1's test-out takes all 20 of a and b.
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
    const units = await sql<{ id: number; key: string }>(
      `INSERT INTO units (section_id, key, position, title, status)
       VALUES ($1, 'u1', 0, 'u1', 'published'), ($1, 'u2', 1, 'u2', 'published')
       RETURNING id, key`,
      [section!.id],
    );
    const lessons = await sql<{ id: number; key: string }>(
      `INSERT INTO lessons (unit_id, key, position, type, title, status)
       VALUES ($1, 'a', 0, 'unit_review', 'a', 'published'),
              ($1, 'b', 1, 'unit_review', 'b', 'published'),
              ($2, 'c', 0, 'unit_review', 'c', 'published')
       RETURNING id, key`,
      [units[0]!.id, units[1]!.id],
    );
    await sql(
      `INSERT INTO exercises (lesson_id, type, payload, origin)
       SELECT l.id, 'test_echo', jsonb_build_object('prompt', l.key || n, 'answer', 'Water'),
              'authored'
         FROM lessons l, generate_series(1, 10) AS n`,
    );
    return {
      courseId: course!.id,
      unit: Object.fromEntries(units.map((u) => [u.key, u.id])),
      lesson: Object.fromEntries(lessons.map((l) => [l.key, l.id])),
    };
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

  function start(unitId: number, session: object) {
    return app.inject({ method: 'POST', url: `/api/v1/units/${unitId}/test-out`, ...session });
  }

  /** Responses with the first `right` exercises answered right and the rest wrong twice. */
  function responses(right = EXERCISES): object[] {
    return Array.from({ length: EXERCISES }, (_, i) => ({
      attempts: i < right ? ['Water'] : ['fire', 'ice'],
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
      url: `/api/v1/test-out-sessions/${sessionId}/complete`,
      cookies: learnerSession.cookies as Record<string, string>,
      headers: { ...learnerSession.headers, ...(key ? { 'idempotency-key': key } : {}) },
      payload,
    });
  }

  const counts = () =>
    sql<{ xp: number; units: number; progress: number; keys: number; sessions: number }>(
      `SELECT (SELECT count(*)::int FROM xp_events) AS xp,
              (SELECT count(*)::int FROM unit_completions) AS units,
              (SELECT count(*)::int FROM lesson_progress) AS progress,
              (SELECT count(*)::int FROM idempotency_keys) AS keys,
              (SELECT count(*)::int FROM lesson_sessions) AS sessions`,
    ).then((rows) => rows[0]);

  it('builds 20 exercises from every lesson of the unit, and resumes them (FR-024, FR-050)', async () => {
    const { courseId, unit } = await seed();
    const { session } = await learner('aiko', courseId);

    const started = await start(unit.u1!, session);
    expect(started.statusCode).toBe(200);
    const body = started.json<TestOutSession>();
    expect(body).toMatchObject({ unitId: unit.u1, unitTitle: 'u1', plugin: 'test' });
    // The lessons' stored exercises in turn: a1, b1, a2, b2, ...
    expect(body.exercises.map((e) => e.payload.prompt)).toEqual(
      Array.from({ length: 10 }, (_, i) => [`a${i + 1}`, `b${i + 1}`]).flat(),
    );
    expect((await start(unit.u1!, session)).json<TestOutSession>().id).toBe(body.id);
  });

  it('passes at 85%: finishes the unit, opens its lessons and the next unit, awards 30 XP (FR-024, FR-021)', async () => {
    const { courseId, unit } = await seed();
    const { userId, session } = await learner('aiko', courseId);
    const { id } = (await start(unit.u1!, session)).json<TestOutSession>();

    const response = await complete(id, session, { responses: responses(17) });
    expect(response.statusCode).toBe(200);
    const result = response.json<TestOutCompletion>();
    expect(result).toMatchObject({
      unitId: unit.u1,
      accuracy: 85,
      passed: true,
      xpEarned: 30,
      totalXp: 30,
    });
    const [u1, u2] = result.path.sections[0]!.units;
    expect(u1!.lessons.map((l) => l.state)).toEqual(['available', 'available']);
    expect(u1!.testOutAvailable).toBe(false);
    expect(u2!.lessons[0]!.state).toBe('available');
    expect(u2!.testOutAvailable).toBe(true);
    expect(await sql(`SELECT reason, ref_id AS id, amount FROM xp_events`)).toEqual([
      { reason: 'test_out', id: unit.u1, amount: 30 },
    ]);
    expect(
      await sql(`SELECT unit_id AS id, tested_out FROM unit_completions WHERE user_id = $1`, [
        userId,
      ]),
    ).toEqual([{ id: unit.u1, tested_out: true }]);
    // The session is used up, and a finished unit offers no test-out.
    expect(await counts()).toMatchObject({ progress: 0, sessions: 0 });
    expect((await complete(id, session, { responses: responses() })).statusCode).toBe(404);
    expect((await start(unit.u1!, session)).statusCode).toBe(409);
  });

  it('fails below 85% and changes nothing but the used-up session (FR-024)', async () => {
    const { courseId, unit } = await seed();
    const { session } = await learner('aiko', courseId);
    const { id } = (await start(unit.u1!, session)).json<TestOutSession>();

    // 16 of 20 is 80%, the closest score below 85% that 20 exercises allow.
    const response = await complete(id, session, { responses: responses(16) });
    expect(response.json<TestOutCompletion>()).toMatchObject({
      accuracy: 80,
      passed: false,
      xpEarned: 0,
      totalXp: 0,
      level: 1,
    });
    const [u1, u2] = response.json<TestOutCompletion>().path.sections[0]!.units;
    expect(u1!.lessons.map((l) => l.state)).toEqual(['available', 'locked']);
    expect(u1!.testOutAvailable).toBe(true);
    expect(u2!.lessons[0]!.state).toBe('locked');
    expect(await counts()).toEqual({ xp: 0, units: 0, progress: 0, keys: 0, sessions: 0 });
  });

  it('applies a repeated Idempotency-Key once and replays the first response (FR-052)', async () => {
    const { courseId, unit } = await seed();
    const { session } = await learner('aiko', courseId);
    const { id } = (await start(unit.u1!, session)).json<TestOutSession>();

    const first = await complete(id, session, { responses: responses() }, 'key-1');
    const again = await complete(id, session, { responses: responses() }, 'key-1');
    expect(first.statusCode).toBe(200);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first.json());
    expect(await counts()).toEqual({ xp: 1, units: 1, progress: 0, keys: 1, sessions: 0 });

    const other = await complete(id, session, { responses: responses(3) }, 'key-1');
    expect(other.statusCode).toBe(409);
    expect(other.json()).toMatchObject({ error: { code: 'idempotency_conflict' } });
  });

  it('refuses locked and unknown units, and sessions of the other kind or another learner (NFR-14)', async () => {
    const { courseId, unit, lesson } = await seed();
    const aiko = await learner('aiko', courseId);
    const ben = await learner('ben', courseId);

    expect((await start(unit.u2!, aiko.session)).statusCode).toBe(403);
    expect((await start(999999, aiko.session)).statusCode).toBe(404);

    const { id } = (await start(unit.u1!, aiko.session)).json<TestOutSession>();
    expect((await complete(id, ben.session, { responses: responses() })).statusCode).toBe(404);
    expect((await complete(id, aiko.session, { responses: responses().slice(1) })).statusCode).toBe(
      400,
    );
    // A test-out session does not complete as a lesson, nor a lesson session as a test-out.
    const asLesson = await app.inject({
      method: 'POST',
      url: `/api/v1/lesson-sessions/${id}/complete`,
      ...aiko.session,
      payload: { responses: responses().slice(0, 10) },
    });
    expect(asLesson.statusCode).toBe(404);
    const lessonSession = await app.inject({
      method: 'POST',
      url: `/api/v1/lessons/${lesson.a}/sessions`,
      ...aiko.session,
    });
    const asTestOut = await complete(lessonSession.json<{ id: number }>().id, aiko.session, {
      responses: responses(),
    });
    expect(asTestOut.statusCode).toBe(404);
    expect(await counts()).toEqual({ xp: 0, units: 0, progress: 0, keys: 0, sessions: 2 });
  });
});

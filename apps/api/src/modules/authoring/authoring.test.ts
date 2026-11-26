import type { FastifyInstance } from 'fastify';
import type { CourseTree } from '@manabi/core';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import type { NewUser } from '../auth/queries';

// API tests for the course tree editor (issue #41): FR-006, FR-022, FR-220, FR-225.

const PASSWORD = 'correct horse battery';

describeWithDb('authoring course tree API', () => {
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

  async function as(overrides: Partial<NewUser>) {
    const user = await seedUser(pool(), {
      passwordHash: await hashPassword(PASSWORD),
      ...overrides,
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: overrides.username, password: PASSWORD },
    });
    expect(response.statusCode).toBe(200);
    const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
    return {
      userId: user.id,
      session: {
        cookies: { [SESSION_COOKIE]: cookie },
        headers: { origin: 'http://localhost:3000' },
      },
    };
  }

  function call(
    session: object,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) {
    return app.inject({ method, url: `/api/v1${url}`, payload, ...session });
  }

  /** Sends a change as the admin, expects 200 and returns the tree it answers with. */
  let admin: object;
  async function ok(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) {
    const response = await call(admin, method, url, payload);
    expect([response.statusCode, response.statusCode === 200 || response.json()]).toEqual([
      200,
      true,
    ]);
    return response.json<CourseTree>();
  }

  /** "section/unit/lesson (status)" for every row of the tree, in order. */
  const outline = (tree: CourseTree) =>
    tree.sections.flatMap((s) => [
      s.title,
      ...s.units.flatMap((u) => [
        `${s.title}/${u.title} (${u.status})`,
        ...u.lessons.map((l) => `${s.title}/${u.title}/${l.title} (${l.status})`),
      ]),
    ]);

  /** A course with section N5, unit Greetings and lessons a, b, c; returns the ids. */
  async function buildTree() {
    const courseId = await seedCourse(pool());
    let tree = await ok('POST', `/authoring/courses/${courseId}/sections`, {
      slug: 'n5',
      title: 'N5',
      levelCode: 'N5',
    });
    const sectionId = tree.sections[0]!.id;
    tree = await ok('POST', '/authoring/units', {
      sectionId,
      slug: 'greetings',
      title: 'Greetings',
    });
    const unitId = tree.sections[0]!.units[0]!.id;
    for (const slug of ['a', 'b', 'c']) {
      tree = await ok('POST', '/authoring/lessons', {
        unitId,
        slug,
        type: 'vocabulary',
        title: slug,
      });
    }
    const [a, b, c] = tree.sections[0]!.units[0]!.lessons.map((l) => l.id);
    return { courseId, sectionId, unitId, a: a!, b: b!, c: c! };
  }

  beforeEach(async () => {
    admin = (await as({ username: 'root', role: 'admin' })).session;
  });

  it('refuses learners on every authoring route (FR-006)', async () => {
    const ids = await buildTree();
    const { session } = await as({ username: 'aiko' });
    const attempts = [
      call(session, 'GET', `/authoring/courses/${ids.courseId}`),
      call(session, 'POST', `/authoring/courses/${ids.courseId}/sections`, {
        slug: 'n4',
        title: 'N4',
        levelCode: 'N4',
      }),
      call(session, 'PATCH', `/authoring/sections/${ids.sectionId}`, { title: 'x' }),
      call(session, 'DELETE', `/authoring/sections/${ids.sectionId}`),
      call(session, 'POST', '/authoring/units', {
        sectionId: ids.sectionId,
        slug: 'x',
        title: 'x',
      }),
      call(session, 'PATCH', `/authoring/units/${ids.unitId}`, { status: 'published' }),
      call(session, 'DELETE', `/authoring/units/${ids.unitId}`),
      call(session, 'POST', '/authoring/lessons', {
        unitId: ids.unitId,
        slug: 'x',
        type: 'kana',
        title: 'x',
      }),
      call(session, 'PATCH', `/authoring/lessons/${ids.a}`, { position: 2 }),
      call(session, 'DELETE', `/authoring/lessons/${ids.a}`),
    ];
    for (const response of await Promise.all(attempts)) expect(response.statusCode).toBe(403);
    expect(outline(await ok('GET', `/authoring/courses/${ids.courseId}`))).toEqual([
      'N5',
      'N5/Greetings (draft)',
      'N5/Greetings/a (draft)',
      'N5/Greetings/b (draft)',
      'N5/Greetings/c (draft)',
    ]);
  });

  it('creates, edits and deletes sections, units and lessons (FR-220)', async () => {
    const ids = await buildTree();
    const [lesson] = await query<{ key: string; position: number }>(
      pool(),
      `SELECT key, position FROM lessons WHERE id = $1`,
      [ids.c],
    );
    expect(lesson).toEqual({ key: 'ja-en:n5:greetings:c', position: 2 });

    await ok('PATCH', `/authoring/sections/${ids.sectionId}`, { title: 'Basics', levelCode: 'N4' });
    await ok('PATCH', `/authoring/units/${ids.unitId}`, { title: 'Hello' });
    let tree = await ok('PATCH', `/authoring/lessons/${ids.b}`, { title: 'B', type: 'grammar' });
    expect(tree.sections[0]).toMatchObject({ title: 'Basics', levelCode: 'N4' });
    expect(tree.sections[0]!.units[0]!.lessons[1]).toMatchObject({ title: 'B', type: 'grammar' });

    const duplicate = await call(admin, 'POST', '/authoring/lessons', {
      unitId: ids.unitId,
      slug: 'a',
      type: 'kana',
      title: 'again',
    });
    expect(duplicate.statusCode).toBe(409);
    expect((await call(admin, 'PATCH', `/authoring/lessons/${ids.a}`, {})).statusCode).toBe(400);
    expect(
      (await call(admin, 'PATCH', '/authoring/lessons/999999', { title: 'x' })).statusCode,
    ).toBe(404);

    // Without progress, deleting removes the rows.
    tree = await ok('DELETE', `/authoring/lessons/${ids.a}`);
    expect(outline(tree)).toEqual([
      'Basics',
      'Basics/Hello (draft)',
      'Basics/Hello/B (draft)',
      'Basics/Hello/c (draft)',
    ]);
    tree = await ok('DELETE', `/authoring/sections/${ids.sectionId}`);
    expect(tree.sections).toEqual([]);
    const [left] = await query<{ n: number }>(
      pool(),
      `SELECT (SELECT count(*) FROM sections) + (SELECT count(*) FROM units)
              + (SELECT count(*) FROM lessons) AS n`,
    );
    expect(Number(left!.n)).toBe(0);
  });

  it('reorders siblings and stores positions in the new order (FR-220)', async () => {
    const ids = await buildTree();
    let tree = await ok('PATCH', `/authoring/lessons/${ids.c}`, { position: 0 });
    expect(tree.sections[0]!.units[0]!.lessons.map((l) => [l.title, l.position])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ]);
    // A position past the end moves to the end.
    tree = await ok('PATCH', `/authoring/lessons/${ids.c}`, { position: 99 });
    expect(tree.sections[0]!.units[0]!.lessons.map((l) => l.title)).toEqual(['a', 'b', 'c']);

    await ok('POST', '/authoring/units', { sectionId: ids.sectionId, slug: 'food', title: 'Food' });
    tree = await ok('PATCH', `/authoring/units/${ids.unitId}`, { position: 1 });
    expect(tree.sections[0]!.units.map((u) => [u.title, u.position])).toEqual([
      ['Food', 0],
      ['Greetings', 1],
    ]);

    await ok('POST', `/authoring/courses/${ids.courseId}/sections`, {
      slug: 'kana',
      title: 'Kana',
      levelCode: 'kana',
    });
    tree = await ok('PATCH', `/authoring/sections/${ids.sectionId}`, { position: 1 });
    expect(tree.sections.map((s) => [s.title, s.position])).toEqual([
      ['Kana', 0],
      ['N5', 1],
    ]);
  });

  describe('with learner progress', () => {
    let ids: Awaited<ReturnType<typeof buildTree>>;
    let learner: { userId: number; session: object };

    beforeEach(async () => {
      ids = await buildTree();
      learner = await as({ username: 'aiko' });
      await ok('PATCH', `/authoring/units/${ids.unitId}`, { status: 'published' });
      for (const id of [ids.a, ids.b]) {
        await ok('PATCH', `/authoring/lessons/${id}`, { status: 'published' });
      }
      await query(pool(), `INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2);`, [
        learner.userId,
        ids.courseId,
      ]);
      await query(
        pool(),
        `INSERT INTO lesson_progress (user_id, lesson_id, completed_at, best_accuracy)
         VALUES ($1, $2, now(), 90)`,
        [learner.userId, ids.a],
      );
      await query(
        pool(),
        `INSERT INTO lesson_sessions (user_id, lesson_id, state, expires_at)
         VALUES ($1, $2, '{}', now() + interval '1 day')`,
        [learner.userId, ids.b],
      );
    });

    /** Every progress row the learner has, as text. */
    async function progress() {
      const rows = await query<{ t: string }>(
        pool(),
        `SELECT 'p' || row_to_json(p)::text AS t FROM lesson_progress p
         UNION ALL SELECT 's' || row_to_json(s)::text FROM lesson_sessions s
         UNION ALL SELECT 'u' || row_to_json(u)::text FROM unit_completions u
         UNION ALL SELECT 'e' || row_to_json(e)::text FROM enrollments e
         UNION ALL SELECT 'x' || row_to_json(x)::text FROM xp_events x
         ORDER BY 1`,
      );
      return rows.map((r) => r.t);
    }

    it('shows learners only published units and lessons (FR-022)', async () => {
      const response = await call(learner.session, 'GET', `/courses/${ids.courseId}/path`);
      // The course itself is a draft, so publish it the way a pack import would.
      expect(response.statusCode).toBe(404);
      await query(pool(), `UPDATE courses SET status = 'published' WHERE id = $1`, [ids.courseId]);
      const path = (await call(learner.session, 'GET', `/courses/${ids.courseId}/path`)).json<{
        sections: { units: { lessons: { title: string }[] }[] }[];
      }>();
      expect(path.sections[0]!.units[0]!.lessons.map((l) => l.title)).toEqual(['a', 'b']);
    });

    it('never changes progress rows when publishing or reordering (FR-225)', async () => {
      const before = await progress();
      expect(before).toHaveLength(3);
      await ok('PATCH', `/authoring/lessons/${ids.c}`, { status: 'published' });
      await ok('PATCH', `/authoring/lessons/${ids.a}`, { status: 'draft' });
      await ok('PATCH', `/authoring/units/${ids.unitId}`, { status: 'draft' });
      await ok('PATCH', `/authoring/units/${ids.unitId}`, { status: 'published' });
      await ok('PATCH', `/authoring/lessons/${ids.c}`, { position: 0 });
      await ok('PATCH', `/authoring/lessons/${ids.a}`, { position: 2, title: 'renamed' });
      await ok('PATCH', `/authoring/sections/${ids.sectionId}`, { position: 0 });
      expect(await progress()).toEqual(before);
    });

    it('archives a lesson with progress instead of deleting it (FR-225)', async () => {
      const before = await progress();
      let tree = await ok('DELETE', `/authoring/lessons/${ids.a}`);
      tree = await ok('DELETE', `/authoring/lessons/${ids.b}`);
      expect(tree.sections[0]!.units[0]!.lessons.map((l) => l.title)).toEqual(['c']);
      const rows = await query<{ id: number; archived: boolean }>(
        pool(),
        `SELECT id, archived_at IS NOT NULL AS archived FROM lessons ORDER BY id`,
      );
      expect(rows).toEqual([
        { id: ids.a, archived: true },
        { id: ids.b, archived: true },
        { id: ids.c, archived: false },
      ]);
      expect(await progress()).toEqual(before);

      // Archived lessons keep their slot behind the active ones: adding and reordering still work.
      await ok('POST', '/authoring/lessons', {
        unitId: ids.unitId,
        slug: 'd',
        type: 'kana',
        title: 'd',
      });
      tree = await ok('PATCH', `/authoring/lessons/${ids.c}`, { position: 1 });
      expect(tree.sections[0]!.units[0]!.lessons.map((l) => l.title)).toEqual(['d', 'c']);
      // A unit holding archived progress is archived too.
      tree = await ok('DELETE', `/authoring/units/${ids.unitId}`);
      expect(tree.sections[0]!.units).toEqual([]);
      const [unit] = await query<{ archived: boolean }>(
        pool(),
        `SELECT archived_at IS NOT NULL AS archived FROM units WHERE id = $1`,
        [ids.unitId],
      );
      expect(unit!.archived).toBe(true);
    });
  });
});

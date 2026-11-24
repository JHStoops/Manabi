import type { FastifyInstance } from 'fastify';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import type { NewUser } from '../auth/queries';
import { insertUnitCompletion } from './queries';

// API tests for the course list, enrollment and path (issue #24): FR-020 to FR-023.

const PASSWORD = 'correct horse battery';

describeWithDb('courses API', () => {
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

  /** Signs a new user in and returns the request options carrying their session cookie. */
  async function as(overrides: Partial<NewUser>) {
    await seedUser(pool(), { passwordHash: await hashPassword(PASSWORD), ...overrides });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: overrides.username, password: PASSWORD },
    });
    expect(response.statusCode).toBe(200);
    const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
    // Cookie-authenticated writes need a same-origin Origin header.
    return { cookies: { [SESSION_COOKIE]: cookie }, headers: { origin: 'http://localhost:3000' } };
  }

  /** A course with one section of two units; returns the course id and lesson ids by key. */
  async function seedCourse(key: string, status: 'draft' | 'published' = 'published') {
    const [course] = await query<{ id: number }>(
      pool(),
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ($1::text, 'ja', 'en', 'ja', $1::text, $2) RETURNING id`,
      [key, status],
    );
    const lessons = await query<{ id: number; key: string }>(
      pool(),
      `WITH s AS (
         INSERT INTO sections (course_id, key, position, title, level_code)
         VALUES ($1, $2 || ':n5', 0, 'N5', 'N5') RETURNING id
       ), u AS (
         INSERT INTO units (section_id, key, position, title, status)
         SELECT s.id, $2 || ':' || v.key, v.position, v.key, 'published'
           FROM s, (VALUES ('u1', 0), ('u2', 1)) AS v (key, position)
         RETURNING id, key
       )
       INSERT INTO lessons (unit_id, key, position, type, title, status)
       SELECT u.id, u.key || ':' || v.key, v.position, 'vocabulary', v.key, v.status
         FROM u, (VALUES ('l1', 0, 'published'), ('l2', 1, 'published'), ('draft', 2, 'draft'))
                 AS v (key, position, status)
       RETURNING id, key`,
      [course!.id, key],
    );
    return {
      courseId: course!.id,
      lesson: Object.fromEntries(lessons.map((l) => [l.key.replace(`${key}:`, ''), l.id])),
    };
  }

  function complete(userId: number, lessonId: number) {
    return query(
      pool(),
      `INSERT INTO lesson_progress (user_id, lesson_id, completed_at, best_accuracy)
       VALUES ($1, $2, now(), 100)`,
      [userId, lessonId],
    );
  }

  const get = (url: string, session: object) =>
    app.inject({ method: 'GET', url: `/api/v1${url}`, ...session });

  /** "unit/lesson: state" for every lesson on the path, in order. */
  async function states(courseId: number, session: object, preview = false) {
    const response = await get(
      `/courses/${courseId}/path${preview ? '?preview=true' : ''}`,
      session,
    );
    expect(response.statusCode).toBe(200);
    const path = response.json<{
      sections: { units: { title: string; lessons: { title: string; state: string }[] }[] }[];
    }>();
    return path.sections.flatMap((s) =>
      s.units.flatMap((u) => u.lessons.map((l) => `${u.title}/${l.title}: ${l.state}`)),
    );
  }

  it('hides draft lessons from a learner and shows them in an admin preview (FR-022)', async () => {
    const { courseId } = await seedCourse('ja-en');
    const learner = await as({ username: 'aiko' });
    const admin = await as({ username: 'root', role: 'admin' });

    expect(await states(courseId, learner)).toEqual([
      'u1/l1: available',
      'u1/l2: locked',
      'u2/l1: locked',
      'u2/l2: locked',
    ]);
    expect(await states(courseId, admin, true)).toEqual([
      'u1/l1: available',
      'u1/l2: locked',
      'u1/draft: locked',
      'u2/l1: locked',
      'u2/l2: locked',
      'u2/draft: locked',
    ]);
    // Without asking for a preview an admin sees what learners see.
    expect(await states(courseId, admin)).toHaveLength(4);
    const denied = await get(`/courses/${courseId}/path?preview=true`, learner);
    expect(denied.statusCode).toBe(403);
  });

  it('hides draft courses from learners but not from an admin preview', async () => {
    const { courseId } = await seedCourse('zh-en', 'draft');
    const learner = await as({ username: 'aiko' });
    const admin = await as({ username: 'root', role: 'admin' });
    expect((await get(`/courses/${courseId}/path`, learner)).statusCode).toBe(404);
    expect((await get('/courses', learner)).json()).toEqual({ courses: [] });
    expect(await states(courseId, admin, true)).toHaveLength(6);
    expect((await get('/courses', admin)).json().courses).toMatchObject([
      { id: courseId, status: 'draft' },
    ]);
    const enroll = await app.inject({
      method: 'POST',
      url: `/api/v1/courses/${courseId}/enroll`,
      ...learner,
    });
    expect(enroll.statusCode).toBe(404);
  });

  it('enrolls in two courses and switches the active course (FR-023)', async () => {
    const ja = await seedCourse('ja-en');
    const zh = await seedCourse('zh-en');
    const learner = await as({ username: 'aiko' });
    const enroll = (courseId: number) =>
      app.inject({ method: 'POST', url: `/api/v1/courses/${courseId}/enroll`, ...learner });
    const list = async () =>
      (await get('/courses', learner))
        .json<{ courses: { key: string; enrolled: boolean; active: boolean }[] }>()
        .courses.map((c) => `${c.key} enrolled=${c.enrolled} active=${c.active}`);

    expect(await list()).toEqual([
      'ja-en enrolled=false active=false',
      'zh-en enrolled=false active=false',
    ]);

    const first = await enroll(ja.courseId);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ id: ja.courseId, enrolled: true, active: true });
    expect((await enroll(zh.courseId)).statusCode).toBe(200);
    expect(await list()).toEqual([
      'ja-en enrolled=true active=false',
      'zh-en enrolled=true active=true',
    ]);

    // Switching back is enrolling again: the enrollment (and its XP) is kept.
    expect((await enroll(ja.courseId)).statusCode).toBe(200);
    expect(await list()).toEqual([
      'ja-en enrolled=true active=true',
      'zh-en enrolled=true active=false',
    ]);
    expect(await query(pool(), `SELECT count(*)::int AS n FROM enrollments`)).toEqual([{ n: 2 }]);
    const me = await get('/me', learner);
    expect(me.json().settings.activeCourseId).toBe(ja.courseId);

    expect((await enroll(999_999)).statusCode).toBe(404);
  });

  it("never shows learner A learner B's lesson states", async () => {
    const { courseId, lesson } = await seedCourse('ja-en');
    const a = await as({ username: 'aiko' });
    await as({ username: 'botan' });
    const [b] = await query<{ id: number }>(
      pool(),
      `SELECT id FROM users WHERE username = 'botan'`,
    );
    await complete(b!.id, lesson['u1:l1']!);
    await complete(b!.id, lesson['u1:l2']!);

    expect(await states(courseId, a)).toEqual([
      'u1/l1: available',
      'u1/l2: locked',
      'u2/l1: locked',
      'u2/l2: locked',
    ]);
    // A query parameter cannot point the path at someone else.
    expect(await states(courseId, { ...a, query: { userId: String(b!.id) } })).toContain(
      'u1/l1: available',
    );
  });

  it('keeps the next unit open when a lesson is added to a completed unit (FR-021, FR-232)', async () => {
    const { courseId, lesson } = await seedCourse('ja-en');
    const learner = await as({ username: 'aiko' });
    const [user] = await query<{ id: number }>(pool(), `SELECT id FROM users`);
    await complete(user!.id, lesson['u1:l1']!);
    await complete(user!.id, lesson['u1:l2']!);
    expect(await states(courseId, learner)).toEqual([
      'u1/l1: completed',
      'u1/l2: completed',
      'u2/l1: available',
      'u2/l2: locked',
    ]);
    // The lesson-completion transaction records the finished unit (#37).
    const [unit] = await query<{ unit_id: number }>(
      pool(),
      `SELECT unit_id FROM lessons WHERE id = $1`,
      [lesson['u1:l1']],
    );
    await insertUnitCompletion(pool(), user!.id, unit!.unit_id);

    // A content update publishes a lesson in unit 1 (created before the learner finished it).
    await query(pool(), `UPDATE lessons SET status = 'published' WHERE id = $1`, [
      lesson['u1:draft'],
    ]);
    expect(await states(courseId, learner)).toEqual([
      'u1/l1: completed',
      'u1/l2: completed',
      'u1/draft: available',
      'u2/l1: available',
      'u2/l2: locked',
    ]);
  });
});

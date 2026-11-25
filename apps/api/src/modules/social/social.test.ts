import type { FastifyInstance } from 'fastify';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import type { NewUser } from '../auth/queries';

// API tests for follows, friends, profiles and nudges (issue #70): FR-182 to FR-184.

const PASSWORD = 'correct horse battery';

describeWithDb('social API', () => {
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

  /** Seeds and signs in a user; returns their id and request options carrying the session. */
  async function as(username: string, overrides: Partial<NewUser> = {}) {
    const user = await seedUser(pool(), {
      username,
      displayName: username,
      passwordHash: await hashPassword(PASSWORD),
      ...overrides,
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: username, password: PASSWORD },
    });
    const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
    return {
      id: user.id,
      opts: { cookies: { [SESSION_COOKIE]: cookie }, headers: { origin: 'http://localhost:3000' } },
    };
  }

  const send = (
    who: { opts: object },
    method: 'PUT' | 'DELETE' | 'POST' | 'GET',
    url: string,
    payload?: object,
  ) => app.inject({ method, url: `/api/v1${url}`, payload, ...who.opts });

  it('follows and unfollows, both idempotently, and lists friends', async () => {
    const hana = await as('hana');
    const ken = await as('ken');
    expect((await send(hana, 'PUT', `/follows/${ken.id}`)).statusCode).toBe(204);
    expect((await send(hana, 'PUT', `/follows/${ken.id}`)).statusCode).toBe(204);
    const friends = (await send(hana, 'GET', '/friends')).json();
    expect(friends.friends.map((f: { id: number }) => f.id)).toEqual([ken.id]);
    // One-way: ken follows no one.
    expect((await send(ken, 'GET', '/friends')).json().friends).toEqual([]);

    expect((await send(hana, 'DELETE', `/follows/${ken.id}`)).statusCode).toBe(204);
    expect((await send(hana, 'DELETE', `/follows/${ken.id}`)).statusCode).toBe(204);
    expect((await send(hana, 'GET', '/friends')).json().friends).toEqual([]);
  });

  it('refuses following yourself, unknown learners and disabled learners', async () => {
    const hana = await as('hana');
    const gone = await seedUser(pool(), { username: 'gone' });
    await query(pool(), `UPDATE users SET disabled_at = now() WHERE id = $1`, [gone.id]);
    expect((await send(hana, 'PUT', `/follows/${hana.id}`)).statusCode).toBe(400);
    expect((await send(hana, 'PUT', '/follows/99999')).statusCode).toBe(404);
    expect((await send(hana, 'PUT', `/follows/${gone.id}`)).statusCode).toBe(404);
  });

  it('requires a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/friends' });
    expect(response.statusCode).toBe(401);
  });

  it('shows streak, level, weekly XP and section on the friends list', async () => {
    const hana = await as('hana');
    const ken = await as('ken');
    const [course] = await query<{ id: number }>(
      pool(),
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('c', 'ja', 'en', 'ja', 'C', 'published') RETURNING id`,
    );
    await query(
      pool(),
      `WITH s AS (INSERT INTO sections (course_id, key, position, title, level_code)
                  VALUES ($1, 'c:n5', 0, 'Starting out', 'N5') RETURNING id)
       INSERT INTO units (section_id, key, position, title, status)
       SELECT id, 'c:u1', 0, 'U1', 'published' FROM s`,
      [course!.id],
    );
    await query(pool(), `UPDATE users SET settings = settings || $2::jsonb WHERE id = $1`, [
      ken.id,
      JSON.stringify({ activeCourseId: course!.id }),
    ]);
    await query(
      pool(),
      `INSERT INTO enrollments (user_id, course_id, total_xp, level) VALUES ($1, $2, 300, 3)`,
      [ken.id, course!.id],
    );
    await query(
      pool(),
      `INSERT INTO user_stats (user_id, current_streak, longest_streak) VALUES ($1, 5, 5)`,
      [ken.id],
    );
    await query(
      pool(),
      `INSERT INTO xp_events (user_id, course_id, base_amount, amount, reason, earned_at, local_date)
       VALUES ($1, $2, 40, 40, 'lesson_new', now(), (now() AT TIME ZONE 'UTC')::date),
              ($1, $2, 90, 90, 'lesson_new', now() - interval '60 days', (now() AT TIME ZONE 'UTC')::date - 60)`,
      [ken.id, course!.id],
    );
    await send(hana, 'PUT', `/follows/${ken.id}`);

    expect((await send(hana, 'GET', '/friends')).json().friends).toEqual([
      {
        id: ken.id,
        displayName: 'ken',
        currentStreak: 5,
        level: 3,
        weeklyXp: 40,
        section: 'Starting out',
        following: true,
      },
    ]);
  });

  it('exposes only public fields on a profile', async () => {
    const hana = await as('hana');
    const ken = await as('ken', { email: 'secret@example.com' });
    const response = await send(hana, 'GET', `/users/${ken.id}/profile`);
    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.json()).sort()).toEqual(
      ['currentStreak', 'displayName', 'following', 'id', 'level', 'section', 'weeklyXp'].sort(),
    );
    expect(response.body).not.toContain('secret@example.com');
    expect((await send(hana, 'GET', '/users/99999/profile')).statusCode).toBe(404);
  });

  describe('nudges', () => {
    it('delivers a nudge, refuses a second one the same day and lists it for the friend', async () => {
      const hana = await as('hana');
      const ken = await as('ken');
      await send(hana, 'PUT', `/follows/${ken.id}`);
      const nudge = { toUserId: ken.id, kind: 'nice_work' };
      expect((await send(hana, 'POST', '/nudges', nudge)).statusCode).toBe(204);
      const again = await send(hana, 'POST', '/nudges', { ...nudge, kind: 'keep_going' });
      expect(again.statusCode).toBe(409);
      expect(again.json().error.code).toBe('conflict');

      const list = (await send(ken, 'GET', '/nudges')).json().nudges;
      expect(list).toMatchObject([
        { fromUserId: hana.id, fromDisplayName: 'hana', kind: 'nice_work', seen: false },
      ]);
      await send(ken, 'POST', '/nudges/seen');
      expect((await send(ken, 'GET', '/nudges')).json().nudges[0].seen).toBe(true);
    });

    it('allows a nudge again on the next day', async () => {
      const hana = await as('hana');
      const ken = await as('ken');
      await send(hana, 'PUT', `/follows/${ken.id}`);
      const nudge = { toUserId: ken.id, kind: 'keep_going' };
      await send(hana, 'POST', '/nudges', nudge);
      await query(
        pool(),
        `UPDATE nudges SET local_date = local_date - 1, sent_at = sent_at - interval '1 day'`,
      );
      expect((await send(hana, 'POST', '/nudges', nudge)).statusCode).toBe(204);
    });

    it('refuses a nudge to a learner who opted out of nudges', async () => {
      const hana = await as('hana');
      const ken = await as('ken', { settings: { allowNudges: false } });
      await send(hana, 'PUT', `/follows/${ken.id}`);
      const response = await send(hana, 'POST', '/nudges', { toUserId: ken.id, kind: 'nice_work' });
      expect(response.statusCode).toBe(403);
      expect(await query(pool(), `SELECT 1 FROM nudges`)).toEqual([]);
    });

    it('refuses a nudge to someone the sender does not follow, to self and to unknown learners', async () => {
      const hana = await as('hana');
      const ken = await as('ken');
      const nudge = (toUserId: number) =>
        send(hana, 'POST', '/nudges', { toUserId, kind: 'nice_work' });
      expect((await nudge(ken.id)).statusCode).toBe(403);
      expect((await nudge(hana.id)).statusCode).toBe(404);
      expect((await nudge(99999)).statusCode).toBe(404);
    });
  });
});

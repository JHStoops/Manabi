import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { z } from '@manabi/core';
import { query, queryOne } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { scopedUserId, SESSION_COOKIE } from './guard';
import { hashPassword } from './passwords';
import type { NewUser } from './queries';
import { createAdmin, createInvite, setTemporaryPassword } from './service';

// API tests for the auth module (issue #12): FR-001, FR-003 to FR-006, IF-06, NFR-10 to NFR-12,
// NFR-14.

const PASSWORD = 'correct horse battery';
const ORIGIN = 'http://localhost:3000';

describeWithDb('auth API', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  async function start(env: NodeJS.ProcessEnv = {}): Promise<FastifyInstance> {
    current = await testApp({ pool: pool(), env });
    return current.app;
  }

  async function user(overrides: Partial<NewUser> = {}, password = PASSWORD) {
    return seedUser(pool(), { passwordHash: await hashPassword(password), ...overrides });
  }

  function login(
    app: FastifyInstance,
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) {
    return app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: body, headers });
  }

  /** Signs in and returns the session cookie value. */
  async function cookieFor(app: FastifyInstance, identifier: string, password = PASSWORD) {
    const response = await login(app, { identifier, password });
    expect(response.statusCode).toBe(200);
    return sessionCookie(response)!.value;
  }

  /** Signs in as a mobile client and returns the bearer token. */
  async function tokenFor(app: FastifyInstance, identifier: string, password = PASSWORD) {
    const response = await login(app, { identifier, password, clientKind: 'mobile' });
    expect(response.statusCode).toBe(200);
    return response.json().token as string;
  }

  function sessionCookie(response: LightMyRequestResponse) {
    return response.cookies.find((c) => c.name === SESSION_COOKIE);
  }

  const withCookie = (value: string, extra: Record<string, string> = {}) => ({
    cookies: { [SESSION_COOKIE]: value },
    headers: { origin: ORIGIN, ...extra },
  });
  const withBearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

  function me(app: FastifyInstance, auth: { cookies?: Record<string, string>; headers?: object }) {
    return app.inject({ method: 'GET', url: '/api/v1/me', ...auth } as never);
  }

  async function expectError(response: LightMyRequestResponse, status: number, code: string) {
    expect({ status: response.statusCode, code: response.json().error?.code }).toEqual({
      status,
      code,
    });
  }

  describe('POST /auth/accept-invite (FR-001)', () => {
    async function invite(email: string | null = null, role: 'learner' | 'admin' = 'learner') {
      const admin = await user({ username: 'admin', role: 'admin' });
      return createInvite(pool(), { email, role, createdBy: admin.id });
    }

    function accept(app: FastifyInstance, body: Record<string, unknown>, ip = '198.51.100.1') {
      return app.inject({
        method: 'POST',
        url: '/api/v1/auth/accept-invite',
        payload: {
          username: 'hana',
          displayName: 'Hana',
          password: PASSWORD,
          dailyGoal: 30,
          timeZone: 'Asia/Tokyo',
          ...body,
        },
        headers: { 'x-forwarded-for': ip },
      });
    }

    it('creates the account with the invite role, signs in and uses up the invite', async () => {
      const { token, invite: row } = await invite('hana@example.com', 'admin');
      const app = await start();
      const response = await accept(app, { token });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        user: expect.objectContaining({
          username: 'hana',
          displayName: 'Hana',
          email: 'hana@example.com',
          role: 'admin',
          mustChangePassword: false,
          timeZone: 'Asia/Tokyo',
          settings: expect.objectContaining({ dailyGoal: 30 }),
        }),
      });
      const cookie = sessionCookie(response)!;
      expect((await me(app, withCookie(cookie.value))).json().username).toBe('hana');
      const used = await queryOne<{ used_by: number; used_at: Date }>(
        pool(),
        `SELECT used_by, used_at FROM invites WHERE id = $1`,
        [row.id],
      );
      expect(used).toEqual({ used_by: response.json().user.id, used_at: expect.any(Date) });
      // Single use.
      const again = await accept(app, { token, username: 'hana2' });
      await expectError(again, 404, 'not_found');
      expect(again.json().error.details).toEqual({ reason: 'used' });
    });

    it('returns a bearer token to mobile clients instead of a cookie', async () => {
      const { token } = await invite();
      const app = await start();
      const response = await accept(app, { token, clientKind: 'mobile', email: 'h@example.com' });
      expect(response.statusCode).toBe(201);
      expect(sessionCookie(response)).toBeUndefined();
      const body = response.json();
      expect(body.user.email).toBe('h@example.com');
      expect((await me(app, withBearer(body.token))).statusCode).toBe(200);
    });

    it.each([
      ['an unknown token', 'invalid'],
      ['an expired invite', 'expired'],
      ['a revoked invite', 'revoked'],
    ])('refuses %s', async (_label, reason) => {
      const { token, invite: row } = await invite();
      if (reason === 'expired') {
        await query(
          pool(),
          `UPDATE invites SET created_at = now() - interval '8 days',
                              expires_at = now() - interval '1 day' WHERE id = $1`,
          [row.id],
        );
      }
      if (reason === 'revoked') {
        await query(pool(), `UPDATE invites SET revoked_at = now() WHERE id = $1`, [row.id]);
      }
      const app = await start();
      const sent = reason === 'invalid' ? 'A'.repeat(43) : token;
      const response = await accept(app, { token: sent });
      await expectError(response, 404, 'not_found');
      expect(response.json().error.details).toEqual({ reason });
      expect(await query(pool(), `SELECT 1 FROM users WHERE username = 'hana'`)).toHaveLength(0);
    });

    it('refuses a taken username, regardless of case, and leaves the invite unused', async () => {
      await user({ username: 'Hana' });
      const { token, invite: row } = await invite();
      const app = await start();
      const response = await accept(app, { token });
      await expectError(response, 409, 'conflict');
      expect(response.json().error.details).toEqual({ field: 'username' });
      const after = await queryOne<{ used_at: Date | null }>(
        pool(),
        `SELECT used_at FROM invites WHERE id = $1`,
        [row.id],
      );
      expect(after!.used_at).toBeNull();
    });

    it.each([
      ['shorter than 10 characters', 'abc123xyz'],
      ['on the common-password list', 'Password1234'],
      ['the username', 'hanakotaro'],
    ])('refuses a password %s', async (_label, password) => {
      const { token } = await invite();
      const app = await start();
      const response = await accept(app, { token, username: 'hanakotaro', password });
      await expectError(response, 400, 'validation_failed');
      expect(response.json().error.details[0].path).toEqual(['password']);
    });

    it('allows 10 attempts per 15 minutes per IP, then answers 429 (NFR-12)', async () => {
      const app = await start();
      for (let i = 0; i < 10; i++) {
        const r = await accept(app, { token: 'B'.repeat(43), username: `guess${i}` });
        expect(r.statusCode).toBe(404);
      }
      const blocked = await accept(app, { token: 'B'.repeat(43), username: 'guess10' });
      await expectError(blocked, 429, 'rate_limited');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      const otherIp = await accept(app, { token: 'B'.repeat(43) }, '198.51.100.2');
      expect(otherIp.statusCode).toBe(404);
    });
  });

  describe('POST /auth/login (FR-003)', () => {
    it('signs in by username or email, ignoring case, with a 30-day session cookie', async () => {
      await user({ username: 'Hana', email: 'hana@example.com' });
      const app = await start();
      for (const identifier of ['hana', 'HANA@example.com']) {
        const response = await login(app, { identifier, password: PASSWORD });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ user: expect.objectContaining({ username: 'Hana' }) });
        expect(response.json().token).toBeUndefined();
        expect(sessionCookie(response)).toMatchObject({
          httpOnly: true,
          sameSite: 'Lax',
          path: '/api/v1',
          maxAge: 30 * 24 * 60 * 60,
        });
      }
    });

    it('marks the cookie HttpOnly, Secure and SameSite=Lax behind HTTPS (NFR-11)', async () => {
      await user();
      const app = await start();
      const response = await login(
        app,
        { identifier: 'learner', password: PASSWORD },
        { 'x-forwarded-proto': 'https' },
      );
      expect(response.statusCode).toBe(200);
      const header = String(response.headers['set-cookie']);
      expect(header).toMatch(/; HttpOnly/);
      expect(header).toMatch(/; Secure/);
      expect(header).toMatch(/; SameSite=Lax/);
      expect(sessionCookie(response)).toMatchObject({ httpOnly: true, secure: true });
    });

    it('marks the cookie Secure in production even without X-Forwarded-Proto (NFR-11)', async () => {
      await user();
      const app = await start({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://unused/x',
        PUBLIC_URL: 'https://manabi.example.com',
        SESSION_SECRET: 's'.repeat(32),
        LOG_LEVEL: 'silent',
      });
      const response = await login(app, { identifier: 'learner', password: PASSWORD });
      expect(response.statusCode).toBe(200);
      expect(sessionCookie(response)).toMatchObject({ httpOnly: true, secure: true });
    });

    it('leaves Secure off for plain http outside production, for local development', async () => {
      await user();
      const app = await start();
      const response = await login(app, { identifier: 'learner', password: PASSWORD });
      expect(sessionCookie(response)!.secure).toBeFalsy();
      expect(String(response.headers['set-cookie'])).not.toMatch(/Secure/);
    });

    it('replaces the session of a browser that signs in again', async () => {
      await user();
      const app = await start();
      const first = await cookieFor(app, 'learner');
      const again = await login(
        app,
        { identifier: 'learner', password: PASSWORD },
        { cookie: `${SESSION_COOKIE}=${first}`, origin: ORIGIN },
      );
      expect(again.statusCode).toBe(200);
      expect(await query(pool(), `SELECT 1 FROM sessions`)).toHaveLength(1);
      await expectError(await me(app, withCookie(first)), 401, 'unauthenticated');
      expect((await me(app, withCookie(sessionCookie(again)!.value))).statusCode).toBe(200);
    });

    it('gives the same answer for a wrong password and an unknown account', async () => {
      await user();
      const app = await start();
      const wrong = await login(app, { identifier: 'learner', password: 'not the password' });
      const unknown = await login(app, { identifier: 'nobody', password: PASSWORD });
      await expectError(wrong, 401, 'unauthenticated');
      expect(unknown.statusCode).toBe(401);
      expect(unknown.json()).toEqual(wrong.json());
      expect(sessionCookie(wrong)).toBeUndefined();
      expect(await query(pool(), `SELECT 1 FROM sessions`)).toHaveLength(0);
    });

    it('refuses a disabled account, and its sessions stop working (FR-200)', async () => {
      const row = await user();
      const app = await start();
      const cookie = await cookieFor(app, 'learner');
      await query(pool(), `UPDATE users SET disabled_at = now() WHERE id = $1`, [row.id]);
      const response = await login(app, { identifier: 'learner', password: PASSWORD });
      await expectError(response, 401, 'unauthenticated');
      expect(sessionCookie(response)).toBeUndefined();
      await expectError(await me(app, withCookie(cookie)), 401, 'unauthenticated');
      // A wrong password does not learn that the account is disabled.
      const wrong = await login(app, { identifier: 'learner', password: 'not the password' });
      expect(wrong.json().error.details).toBeNull();
    });

    it('refuses an expired temporary password (FR-005)', async () => {
      const row = await user();
      await setTemporaryPassword(pool(), row.id, 'temporary pass 1');
      await query(
        pool(),
        `UPDATE users SET password_expires_at = now() - interval '1 minute' WHERE id = $1`,
        [row.id],
      );
      const app = await start();
      const response = await login(app, { identifier: 'learner', password: 'temporary pass 1' });
      await expectError(response, 401, 'unauthenticated');
      expect(response.json().error.details).toEqual({ reason: 'temporary_password_expired' });
    });

    it('rejects the 11th attempt within 15 minutes from one IP (NFR-12)', async () => {
      await user();
      const app = await start();
      const from = (ip: string) => ({ 'x-forwarded-for': ip });
      for (let i = 0; i < 10; i++) {
        const r = await login(app, { identifier: `user${i}`, password: 'x' }, from('203.0.113.7'));
        expect(r.statusCode).toBe(401);
      }
      const blocked = await login(
        app,
        { identifier: 'learner', password: PASSWORD },
        from('203.0.113.7'),
      );
      await expectError(blocked, 429, 'rate_limited');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(15 * 60);
      // Another address is unaffected.
      const other = await login(
        app,
        { identifier: 'learner', password: PASSWORD },
        from('203.0.113.8'),
      );
      expect(other.statusCode).toBe(200);
    });

    it.each([
      ['an existing username, in any case', 'learner', 'LEARNER'],
      ['an unknown username', 'ghost', 'GHOST'],
    ])(
      'rejects the 11th attempt within 15 minutes for %s from many IPs (NFR-12)',
      async (_label, name, variant) => {
        await user();
        const app = await start();
        for (let i = 0; i < 10; i++) {
          const identifier = i % 2 === 0 ? name : variant;
          const r = await login(
            app,
            { identifier, password: 'wrong password' },
            { 'x-forwarded-for': `203.0.113.${i + 10}` },
          );
          expect(r.statusCode).toBe(401);
        }
        const blocked = await login(
          app,
          { identifier: name, password: PASSWORD },
          { 'x-forwarded-for': '203.0.113.99' },
        );
        await expectError(blocked, 429, 'rate_limited');
      },
    );

    it('counts a username and its email separately, so counts do not link them', async () => {
      await user();
      const app = await start();
      for (let i = 0; i < 10; i++) {
        await login(
          app,
          { identifier: 'learner', password: 'wrong password' },
          { 'x-forwarded-for': `203.0.113.${i + 10}` },
        );
      }
      const byName = await login(
        app,
        { identifier: 'learner', password: PASSWORD },
        { 'x-forwarded-for': '203.0.113.99' },
      );
      await expectError(byName, 429, 'rate_limited');
      const byEmail = await login(
        app,
        { identifier: 'learner@example.com', password: PASSWORD },
        { 'x-forwarded-for': '203.0.113.99' },
      );
      expect(byEmail.statusCode).toBe(200);
    });

    it('counts IPv6 clients by their /64 prefix', async () => {
      const app = await start();
      for (let i = 0; i < 10; i++) {
        const r = await login(
          app,
          { identifier: `user${i}`, password: 'x' },
          { 'x-forwarded-for': `2001:db8:1:2::${i + 1}` },
        );
        expect(r.statusCode).toBe(401);
      }
      const sameNet = await login(
        app,
        { identifier: 'user10', password: 'x' },
        { 'x-forwarded-for': '2001:db8:1:2:ffff::1' },
      );
      await expectError(sameNet, 429, 'rate_limited');
      const otherNet = await login(
        app,
        { identifier: 'user10', password: 'x' },
        { 'x-forwarded-for': '2001:db8:1:3::1' },
      );
      expect(otherNet.statusCode).toBe(401);
    });
  });

  describe('sessions (IF-06, FR-004)', () => {
    it('authenticates by cookie and by bearer header; bearer wins over the cookie', async () => {
      await user({ username: 'hana' });
      await user({ username: 'kenji' });
      const app = await start();
      const cookie = await cookieFor(app, 'hana');
      const token = await tokenFor(app, 'kenji');
      expect((await me(app, withCookie(cookie))).json().username).toBe('hana');
      expect((await me(app, withBearer(token))).json().username).toBe('kenji');
      const both = await me(app, { cookies: { [SESSION_COOKIE]: cookie }, ...withBearer(token) });
      expect(both.json().username).toBe('kenji');
    });

    it.each([
      ['no token', {}],
      ['a malformed bearer token', withBearer('nope')],
      ['an unknown bearer token', withBearer('C'.repeat(43))],
      ['another auth scheme', { headers: { authorization: 'Basic abc' } }],
    ])('answers 401 to %s', async (_label, auth) => {
      const app = await start();
      await expectError(await me(app, auth), 401, 'unauthenticated');
    });

    it('clears an unknown session cookie', async () => {
      const app = await start();
      const response = await me(app, withCookie('D'.repeat(43)));
      await expectError(response, 401, 'unauthenticated');
      expect(sessionCookie(response)).toMatchObject({ value: '', maxAge: 0 });
    });

    it('slides the 30-day expiry at most once an hour (FR-003)', async () => {
      await user();
      const app = await start();
      const cookie = await cookieFor(app, 'learner');
      // Recently used: no write, no new cookie.
      await query(
        pool(),
        `UPDATE sessions SET last_seen_at = now() - interval '10 minutes',
                             expires_at = now() + interval '20 days'`,
      );
      const fresh = await me(app, withCookie(cookie));
      expect(fresh.statusCode).toBe(200);
      expect(sessionCookie(fresh)).toBeUndefined();
      const unchanged = await queryOne<{ days: number }>(
        pool(),
        `SELECT round(extract(epoch FROM expires_at - now()) / 86400) AS days FROM sessions`,
      );
      expect(Number(unchanged!.days)).toBe(20);

      // Last used two hours ago: the expiry moves to 30 days from now, and so does the cookie.
      await query(
        pool(),
        `UPDATE sessions SET last_seen_at = now() - interval '2 hours',
                             expires_at = now() + interval '1 day'`,
      );
      const slid = await me(app, withCookie(cookie));
      expect(slid.statusCode).toBe(200);
      expect(sessionCookie(slid)).toMatchObject({ value: cookie, maxAge: 30 * 24 * 60 * 60 });
      const moved = await queryOne<{ days: number; seen: boolean }>(
        pool(),
        `SELECT round(extract(epoch FROM expires_at - now()) / 86400) AS days,
                last_seen_at > now() - interval '1 minute' AS seen
           FROM sessions`,
      );
      expect({ days: Number(moved!.days), seen: moved!.seen }).toEqual({ days: 30, seen: true });
    });

    it('stops accepting a session after 30 days without use', async () => {
      await user();
      const app = await start();
      const cookie = await cookieFor(app, 'learner');
      await query(
        pool(),
        `UPDATE sessions SET created_at = now() - interval '31 days',
                             last_seen_at = now() - interval '30 days 1 minute',
                             expires_at = now() - interval '1 minute'`,
      );
      await expectError(await me(app, withCookie(cookie)), 401, 'unauthenticated');
    });

    it('signs out: the session is deleted and the cookie cleared', async () => {
      await user();
      const app = await start();
      const cookie = await cookieFor(app, 'learner');
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        ...withCookie(cookie),
      });
      expect(response.statusCode).toBe(204);
      expect(sessionCookie(response)).toMatchObject({ value: '', maxAge: 0 });
      expect(await query(pool(), `SELECT 1 FROM sessions`)).toHaveLength(0);
      await expectError(await me(app, withCookie(cookie)), 401, 'unauthenticated');
    });

    it('lists and revokes only your own sessions (NFR-14)', async () => {
      await user({ username: 'hana' });
      await user({ username: 'kenji' });
      const app = await start();
      const phone = await tokenFor(app, 'hana');
      const laptop = await cookieFor(app, 'hana');
      const kenji = await tokenFor(app, 'kenji');

      const list = await app.inject({
        method: 'GET',
        url: '/api/v1/me/sessions',
        ...withBearer(phone),
      });
      expect(list.statusCode).toBe(200);
      const sessions = list.json().sessions as {
        id: number;
        clientKind: string;
        current: boolean;
      }[];
      expect(sessions.map((s) => [s.clientKind, s.current]).sort()).toEqual([
        ['mobile', true],
        ['web', false],
      ]);
      const laptopId = sessions.find((s) => s.clientKind === 'web')!.id;
      const kenjiSession = await queryOne<{ id: number }>(
        pool(),
        `SELECT s.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.username = 'kenji'`,
      );

      // Another learner's session id is not found, and that session keeps working.
      const foreign = await app.inject({
        method: 'DELETE',
        url: `/api/v1/me/sessions/${kenjiSession!.id}`,
        ...withBearer(phone),
      });
      await expectError(foreign, 404, 'not_found');
      expect((await me(app, withBearer(kenji))).statusCode).toBe(200);

      const revoke = await app.inject({
        method: 'DELETE',
        url: `/api/v1/me/sessions/${laptopId}`,
        ...withBearer(phone),
      });
      expect(revoke.statusCode).toBe(204);
      await expectError(await me(app, withCookie(laptop)), 401, 'unauthenticated');
      expect((await me(app, withBearer(phone))).statusCode).toBe(200);

      const bad = await app.inject({
        method: 'DELETE',
        url: '/api/v1/me/sessions/abc',
        ...withBearer(phone),
      });
      await expectError(bad, 400, 'validation_failed');
    });

    it('clears the cookie when you revoke the session you are using', async () => {
      await user();
      const app = await start();
      const cookie = await cookieFor(app, 'learner');
      const { id } = (await queryOne<{ id: number }>(pool(), `SELECT id FROM sessions`))!;
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/me/sessions/${id}`,
        ...withCookie(cookie),
      });
      expect(response.statusCode).toBe(204);
      expect(sessionCookie(response)).toMatchObject({ value: '', maxAge: 0 });
    });
  });

  describe('Origin check (SDD section 11)', () => {
    it('refuses a cookie-authenticated write without a matching Origin', async () => {
      await user();
      const app = await start();
      const cookie = await cookieFor(app, 'learner');
      const logout = (headers: Record<string, string>) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/auth/logout',
          cookies: { [SESSION_COOKIE]: cookie },
          headers,
        });
      await expectError(await logout({}), 403, 'forbidden');
      await expectError(await logout({ origin: 'https://evil.example' }), 403, 'forbidden');
      expect(await query(pool(), `SELECT 1 FROM sessions`)).toHaveLength(1);
      // Reads need no Origin.
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/v1/me',
            cookies: { [SESSION_COOKIE]: cookie },
          })
        ).statusCode,
      ).toBe(200);
      expect((await logout({ origin: ORIGIN })).statusCode).toBe(204);
    });

    it('lets bearer clients write without an Origin', async () => {
      await user();
      const app = await start();
      const token = await tokenFor(app, 'learner');
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        ...withBearer(token),
      });
      expect(response.statusCode).toBe(204);
    });

    it('refuses a cross-site sign-in form', async () => {
      await user();
      const app = await start();
      const response = await login(
        app,
        { identifier: 'learner', password: PASSWORD },
        { origin: 'https://evil.example' },
      );
      await expectError(response, 403, 'forbidden');
    });
  });

  describe('temporary passwords and POST /auth/change-password (FR-005)', () => {
    const TEMP = 'temporary pass 1';
    const NEW = 'a brand new passphrase';

    function change(app: FastifyInstance, auth: object, body: Record<string, unknown>) {
      return app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        payload: body,
        ...auth,
      } as never);
    }

    it('limits a temporary-password session to changing the password', async () => {
      const row = await user();
      const app = await start();
      const older = await tokenFor(app, 'learner');
      expect(await setTemporaryPassword(pool(), row.id, TEMP)).toBe(true);
      // Setting a temporary password signs the account out everywhere.
      await expectError(await me(app, withBearer(older)), 401, 'unauthenticated');

      const signIn = await login(app, { identifier: 'learner', password: TEMP });
      expect(signIn.statusCode).toBe(200);
      expect(signIn.json().user.mustChangePassword).toBe(true);
      const temp = sessionCookie(signIn)!.value;
      const other = await tokenFor(app, 'learner', TEMP);

      // GET /me (to show the change-password screen) works; everything else is refused.
      expect((await me(app, withCookie(temp))).json().mustChangePassword).toBe(true);
      const sessions = await app.inject({
        method: 'GET',
        url: '/api/v1/me/sessions',
        ...withCookie(temp),
      });
      await expectError(sessions, 403, 'password_change_required');
      const revoke = await app.inject({
        method: 'DELETE',
        url: '/api/v1/me/sessions/1',
        ...withCookie(temp),
      });
      await expectError(revoke, 403, 'password_change_required');

      const changed = await change(app, withCookie(temp), {
        currentPassword: TEMP,
        newPassword: NEW,
      });
      expect(changed.statusCode).toBe(200);
      expect(changed.json().user.mustChangePassword).toBe(false);
      const fresh = sessionCookie(changed)!.value;
      expect(fresh).not.toBe(temp);

      // All earlier sessions are revoked; the new one works fully.
      await expectError(await me(app, withCookie(temp)), 401, 'unauthenticated');
      await expectError(await me(app, withBearer(other)), 401, 'unauthenticated');
      const now = await app.inject({
        method: 'GET',
        url: '/api/v1/me/sessions',
        ...withCookie(fresh),
      });
      expect(now.statusCode).toBe(200);
      expect(now.json().sessions).toHaveLength(1);
      const userRow = await queryOne<{ must: boolean; expires: Date | null }>(
        pool(),
        `SELECT must_change_password AS must, password_expires_at AS expires FROM users`,
      );
      expect(userRow).toEqual({ must: false, expires: null });
      expect((await login(app, { identifier: 'learner', password: NEW })).statusCode).toBe(200);
      expect((await login(app, { identifier: 'learner', password: TEMP })).statusCode).toBe(401);
    });

    it('gives a bearer client its new token', async () => {
      await user();
      const app = await start();
      const token = await tokenFor(app, 'learner');
      const changed = await change(app, withBearer(token), {
        currentPassword: PASSWORD,
        newPassword: NEW,
      });
      expect(changed.statusCode).toBe(200);
      expect(sessionCookie(changed)).toBeUndefined();
      const fresh = changed.json().token as string;
      expect((await me(app, withBearer(fresh))).statusCode).toBe(200);
      await expectError(await me(app, withBearer(token)), 401, 'unauthenticated');
    });

    it.each([
      [
        'a wrong current password',
        { currentPassword: 'not the password', newPassword: NEW },
        'currentPassword',
      ],
      [
        'an unchanged password',
        { currentPassword: PASSWORD, newPassword: PASSWORD },
        'newPassword',
      ],
      [
        'a common new password',
        { currentPassword: PASSWORD, newPassword: 'qwertyuiop' },
        'newPassword',
      ],
      ['a short new password', { currentPassword: PASSWORD, newPassword: 'short' }, 'newPassword'],
    ])('refuses %s', async (_label, body, field) => {
      await user();
      const app = await start();
      const token = await tokenFor(app, 'learner');
      const response = await change(app, withBearer(token), body);
      await expectError(response, 400, 'validation_failed');
      expect(response.json().error.details[0].path).toEqual([field]);
      expect((await me(app, withBearer(token))).statusCode).toBe(200);
    });

    it('rate limits password checks per account (NFR-12)', async () => {
      await user();
      const app = await start();
      const token = await tokenFor(app, 'learner');
      for (let i = 0; i < 10; i++) {
        const r = await change(app, withBearer(token), {
          currentPassword: `guess number ${i}`,
          newPassword: NEW,
        });
        expect(r.statusCode).toBe(400);
      }
      const blocked = await change(app, withBearer(token), {
        currentPassword: PASSWORD,
        newPassword: NEW,
      });
      await expectError(blocked, 429, 'rate_limited');
    });

    it('reports whether the user exists when setting a temporary password', async () => {
      expect(await setTemporaryPassword(pool(), 999, TEMP)).toBe(false);
    });
  });

  describe('role guard (FR-006)', () => {
    async function appWithGuardedRoutes() {
      const app = await start();
      for (const url of [
        '/api/v1/admin/test-ping',
        '/api/v1/authoring/test-ping',
        '/api/v1/test-mine',
      ]) {
        app.get(url, { schema: { querystring: z.object({}) } }, async (request) => ({
          userId: scopedUserId(request),
        }));
      }
      return app;
    }

    it.each(['/api/v1/admin/test-ping', '/api/v1/authoring/test-ping'])(
      'answers 403 to a learner and 200 to an admin on %s',
      async (url) => {
        await user({ username: 'learner' });
        const admin = await user({ username: 'boss', role: 'admin' });
        const app = await appWithGuardedRoutes();
        const learner = await tokenFor(app, 'learner');
        const boss = await tokenFor(app, 'boss');
        await expectError(
          await app.inject({ method: 'GET', url, ...withBearer(learner) }),
          403,
          'forbidden',
        );
        const ok = await app.inject({ method: 'GET', url, ...withBearer(boss) });
        expect(ok.statusCode).toBe(200);
        expect(ok.json()).toEqual({ userId: admin.id });
        await expectError(await app.inject({ method: 'GET', url }), 401, 'unauthenticated');
      },
    );

    it('lets learners use routes outside the admin groups, scoped to themselves', async () => {
      const learner = await user();
      const app = await appWithGuardedRoutes();
      const token = await tokenFor(app, 'learner');
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/test-mine',
        ...withBearer(token),
      });
      expect(response.json()).toEqual({ userId: learner.id });
    });
  });

  it('stores no plaintext password or token anywhere (NFR-10)', async () => {
    const admin = await user({ username: 'admin', role: 'admin' });
    const { token: inviteToken } = await createInvite(pool(), {
      email: null,
      role: 'learner',
      createdBy: admin.id,
    });
    const app = await start();
    const secrets: string[] = [PASSWORD, inviteToken];
    const accepted = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/accept-invite',
      payload: {
        token: inviteToken,
        username: 'hana',
        displayName: 'Hana',
        password: 'first secret phrase',
        dailyGoal: 10,
        clientKind: 'mobile',
      },
    });
    expect(accepted.statusCode).toBe(201);
    secrets.push('first secret phrase', accepted.json().token);
    secrets.push(await cookieFor(app, 'admin'));
    const changed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      payload: { currentPassword: 'first secret phrase', newPassword: 'second secret phrase' },
      ...withBearer(accepted.json().token),
    });
    expect(changed.statusCode).toBe(200);
    secrets.push('second secret phrase', changed.json().token);
    await setTemporaryPassword(pool(), admin.id, 'temporary secret');
    secrets.push('temporary secret');

    const dump = await query<{ row: string }>(
      pool(),
      `SELECT row_to_json(t)::text AS row FROM users t
       UNION ALL SELECT row_to_json(t)::text FROM sessions t
       UNION ALL SELECT row_to_json(t)::text FROM invites t
       UNION ALL SELECT row_to_json(t)::text FROM password_resets t`,
    );
    const text = dump.map((r) => r.row).join('\n');
    expect(text).toContain('$argon2id$');
    for (const secret of secrets) expect(text).not.toContain(secret);
    const hashes = await query<{ h: string }>(pool(), `SELECT password_hash AS h FROM users`);
    for (const { h } of hashes) expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  describe('PATCH /me (FR-007, NFR-14, NFR-61)', () => {
    function patch(app: FastifyInstance, auth: object, body: unknown) {
      return app.inject({ method: 'PATCH', url: '/api/v1/me', payload: body, ...auth } as never);
    }

    // One non-default value per setting in the Product Spec's table.
    const changed = {
      avatarColor: '#336699',
      avatarInitial: 'は',
      dailyGoal: 50,
      newItemCap: 0,
      reviewCap: 1000,
      drawingExercises: false,
      preferWordBank: true,
      theme: 'sumi',
      colorMode: 'dark',
      readingAnnotations: 'never',
      targetTextSize: 'large',
      soundEffects: false,
      audioAutoplay: false,
      reducedMotion: true,
      appearOnLeaderboard: false,
      allowNudges: false,
    } as const;

    it.each(Object.entries(changed))('round-trips %s', async (key, value) => {
      await user();
      const app = await start();
      const auth = withCookie(await cookieFor(app, 'learner'));
      const response = await patch(app, auth, { settings: { [key]: value } });
      expect(response.statusCode).toBe(200);
      expect(response.json().settings[key]).toEqual(value);
      expect((await me(app, auth)).json().settings[key]).toEqual(value);
    });

    it('changes display name and time zone, and keeps settings not sent', async () => {
      await user();
      const app = await start();
      const auth = withCookie(await cookieFor(app, 'learner'));
      await patch(app, auth, { settings: { theme: 'umi', avatarColor: '#112233' } });
      const response = await patch(app, auth, {
        displayName: 'Hana',
        timeZone: 'America/Denver',
        settings: { avatarColor: null },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        displayName: 'Hana',
        timeZone: 'America/Denver',
        settings: { theme: 'umi', avatarColor: null, dailyGoal: 20 },
      });
    });

    it.each([
      ['an unknown time zone', { timeZone: 'Mars/Olympus' }],
      ['an empty display name', { displayName: '' }],
      ['a bad setting value', { settings: { dailyGoal: 15 } }],
      ['an unknown setting', { settings: { furigana: 'never' } }],
      ['the active course', { settings: { activeCourseId: 1 } }],
      ['a role', { role: 'admin' }],
      ['an email (NFR-61: no new personal fields)', { email: 'new@example.com' }],
      ['another user id', { id: 999 }],
    ])('rejects %s and changes nothing', async (_name, body) => {
      const row = await user();
      const app = await start();
      const auth = withCookie(await cookieFor(app, 'learner'));
      await expectError(await patch(app, auth, body), 400, 'validation_failed');
      const after = await queryOne<{ settings: object; role: string }>(
        pool(),
        `SELECT settings, role FROM users WHERE id = $1`,
        [row.id],
      );
      expect(after).toEqual({ settings: {}, role: 'learner' });
    });

    it("changes only the caller's own row (NFR-14)", async () => {
      await user();
      const other = await user({ username: 'other' });
      const app = await start();
      const auth = withCookie(await cookieFor(app, 'learner'));
      expect(
        (await patch(app, auth, { displayName: 'Mine', settings: { theme: 'sumi' } })).statusCode,
      ).toBe(200);
      const untouched = await queryOne<{ display_name: string; settings: object }>(
        pool(),
        `SELECT display_name, settings FROM users WHERE id = $1`,
        [other.id],
      );
      expect(untouched).toEqual({ display_name: 'other', settings: {} });
    });

    it('needs a signed-in session', async () => {
      const app = await start();
      await expectError(
        await patch(app, { headers: { origin: ORIGIN } }, {}),
        401,
        'unauthenticated',
      );
    });
  });

  it('creates an admin from the CLI who can sign in, with sign-up password rules (FR-009)', async () => {
    const user = await createAdmin(pool(), 'owner', PASSWORD);
    expect(user).toMatchObject({ username: 'owner', role: 'admin', email: null });
    await cookieFor(await start(), 'owner');
    await expect(createAdmin(pool(), 'owner', PASSWORD)).rejects.toThrow('already taken');
    await expect(createAdmin(pool(), 'other', 'short')).rejects.toThrow('at least 10');
    await expect(createAdmin(pool(), 'other', 'password123')).rejects.toThrow('too common');
    await expect(createAdmin(pool(), 'two words', PASSWORD)).rejects.toThrow('Invalid username');
  });
});

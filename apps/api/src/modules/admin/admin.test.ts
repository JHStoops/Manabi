import type { AddressInfo } from 'node:net';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { SMTPServer } from 'smtp-server';
import { query, queryOne } from '../../db/db';
import { BOSS_SCHEMA } from '../../jobs/boss';
import { importJmdictJob } from '../../jobs/importJmdict';
import { startWorker } from '../../jobs/worker';
import type { RunningWorker } from '../../jobs/worker';
import type { Logger } from '../../logger';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, testDatabaseUrl, useTestDatabase } from '../../test/db';
import { seedUser, tokenHash } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import type { NewUser } from '../auth/queries';
import type { ScopedUserId } from '../auth/service';
import { updateUser } from './service';

// API tests for the admin console and password resets (issue #23): FR-002, FR-005, FR-200,
// FR-226, IF-10.

const PASSWORD = 'correct horse battery';
const ORIGIN = 'http://localhost:3000';

const quietLog = () => ({ info() {}, warn() {}, error() {}, debug() {} }) as unknown as Logger;

interface Received {
  to: string[];
  text: string;
}

/** A local SMTP server that keeps what it receives. */
async function startSmtp(): Promise<{ port: number; received: Received[]; stop: () => void }> {
  const received: Received[] = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS'],
    logger: false,
    onData(stream, session, done) {
      let raw = '';
      stream.on('data', (chunk: Buffer) => (raw += chunk.toString('utf8')));
      stream.on('end', () => {
        // Undo quoted-printable soft line breaks and '=' escapes, enough to read the links.
        const text = raw.replace(/=\r?\n/g, '').replace(/=3D/g, '=');
        received.push({ to: session.envelope.rcptTo.map((r) => r.address), text });
        done();
      });
    },
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.server.address() as AddressInfo;
  return { port, received, stop: () => server.close() };
}

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describeWithDb('admin console API', () => {
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

  async function signIn(app: FastifyInstance, identifier: string, password = PASSWORD) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier, password },
    });
    expect(response.statusCode).toBe(200);
    return response.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
  }

  /** Seeds an admin and returns a request helper signed in as them. */
  async function asAdmin(app: FastifyInstance) {
    await user({ username: 'boss', role: 'admin' });
    const cookie = await signIn(app, 'boss');
    return (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
      app.inject({
        method,
        url: `/api/v1${url}`,
        cookies: { [SESSION_COOKIE]: cookie },
        headers: { origin: ORIGIN },
        ...(payload ? { payload } : {}),
      });
  }

  function expectError(response: LightMyRequestResponse, status: number, code: string) {
    expect({ status: response.statusCode, code: response.json().error?.code }).toEqual({
      status,
      code,
    });
  }

  it('is for admins only (FR-006)', async () => {
    const app = await start();
    await user({ username: 'hana' });
    const cookie = await signIn(app, 'hana');
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      cookies: { [SESSION_COOKIE]: cookie },
    });
    expectError(response, 403, 'forbidden');
  });

  describe('invites (FR-002, IF-10)', () => {
    it('creates, lists and revokes invites; a revoked invite cannot be accepted', async () => {
      const app = await start();
      const as = await asAdmin(app);

      const created = await as('POST', '/admin/invites', { role: 'admin', expiresInDays: 3 });
      expect(created.statusCode).toBe(201);
      const body = created.json();
      // No SMTP configured: the link is returned to copy and nothing is emailed.
      expect(body).toEqual({
        invite: expect.objectContaining({ role: 'admin', email: null, status: 'pending' }),
        link: expect.stringMatching(/^http:\/\/localhost:3000\/invite\/[A-Za-z0-9_-]{43}$/),
        emailed: false,
      });
      const days =
        (Date.parse(body.invite.expiresAt) - Date.parse(body.invite.createdAt)) / 86_400_000;
      expect(Math.round(days)).toBe(3);

      const defaulted = (await as('POST', '/admin/invites', {})).json();
      expect(defaulted.invite.role).toBe('learner');
      const listed = await as('GET', '/admin/invites');
      expect(listed.json().invites.map((i: { id: number }) => i.id)).toEqual([
        defaulted.invite.id,
        body.invite.id,
      ]);

      expect((await as('DELETE', `/admin/invites/${body.invite.id}`)).statusCode).toBe(204);
      const after = (await as('GET', '/admin/invites')).json().invites;
      expect(after.find((i: { id: number }) => i.id === body.invite.id).status).toBe('revoked');

      const token = body.link.split('/').pop();
      const accept = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/accept-invite',
        payload: {
          token,
          username: 'hana',
          displayName: 'Hana',
          password: PASSWORD,
          dailyGoal: 20,
        },
      });
      expectError(accept, 404, 'not_found');
      expect(accept.json().error.details).toEqual({ reason: 'revoked' });

      expectError(await as('DELETE', '/admin/invites/999'), 404, 'not_found');
    });

    it('refuses to revoke an invite that was used', async () => {
      const app = await start();
      const as = await asAdmin(app);
      const { invite, link } = (await as('POST', '/admin/invites', {})).json();
      const accepted = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/accept-invite',
        payload: {
          token: link.split('/').pop(),
          username: 'hana',
          displayName: 'Hana',
          password: PASSWORD,
          dailyGoal: 20,
        },
      });
      expect(accepted.statusCode).toBe(201);
      expectError(await as('DELETE', `/admin/invites/${invite.id}`), 409, 'conflict');
    });
  });

  describe('users (FR-200, FR-005)', () => {
    it('lists users with last active day and streak', async () => {
      const app = await start();
      const as = await asAdmin(app);
      const hana = await user({ username: 'hana' });
      await query(
        pool(),
        `INSERT INTO user_stats (user_id, current_streak, longest_streak, last_active_date)
         VALUES ($1, 4, 9, '2026-11-20')`,
        [hana.id],
      );
      const users = (await as('GET', '/admin/users')).json().users;
      expect(users).toEqual([
        expect.objectContaining({ username: 'boss', currentStreak: 0, lastActiveDate: null }),
        expect.objectContaining({
          username: 'hana',
          role: 'learner',
          currentStreak: 4,
          lastActiveDate: '2026-11-20',
        }),
      ]);
      expect(users[0]).not.toHaveProperty('passwordHash');
    });

    it('changes roles, and disabling revokes every session', async () => {
      const app = await start();
      const as = await asAdmin(app);
      const hana = await user({ username: 'hana' });
      const hanaCookie = await signIn(app, 'hana');

      const promoted = await as('PATCH', `/admin/users/${hana.id}`, { role: 'admin' });
      expect(promoted.statusCode).toBe(200);
      expect(promoted.json()).toMatchObject({ role: 'admin', disabledAt: null });

      const disabled = await as('PATCH', `/admin/users/${hana.id}`, { disabled: true });
      expect(disabled.json().disabledAt).toEqual(expect.any(String));
      const sessions = await queryOne<{ n: number }>(
        pool(),
        `SELECT count(*) AS n FROM sessions WHERE user_id = $1`,
        [hana.id],
      );
      expect(sessions!.n).toBe(0);
      const meAfter = await app.inject({
        method: 'GET',
        url: '/api/v1/me',
        cookies: { [SESSION_COOKIE]: hanaCookie },
      });
      expectError(meAfter, 401, 'unauthenticated');

      const enabled = await as('PATCH', `/admin/users/${hana.id}`, { disabled: false });
      expect(enabled.json().disabledAt).toBeNull();
      await signIn(app, 'hana');

      expectError(await as('PATCH', '/admin/users/999', { role: 'admin' }), 404, 'not_found');
      expectError(await as('PATCH', `/admin/users/${hana.id}`, {}), 400, 'validation_failed');
    });

    it('does not let an admin demote or disable themselves', async () => {
      const app = await start();
      const as = await asAdmin(app);
      const self = (await as('GET', '/admin/users')).json().users[0];
      expectError(
        await as('PATCH', `/admin/users/${self.id}`, { disabled: true }),
        409,
        'conflict',
      );
    });

    it('refuses to demote or disable the last enabled admin', async () => {
      // Reached when another admin disabled the caller concurrently; called directly here.
      const only = await user({ username: 'only', role: 'admin' });
      const gone = 999 as ScopedUserId;
      for (const change of [{ disabled: true }, { role: 'learner' as const }]) {
        await expect(updateUser(pool(), gone, only.id, change)).rejects.toMatchObject({
          code: 'conflict',
        });
      }
      const second = await user({ username: 'second', role: 'admin' });
      await expect(updateUser(pool(), gone, second.id, { disabled: true })).resolves.toMatchObject({
        username: 'second',
      });
    });

    it('uses up outstanding reset links when setting a temporary password', async () => {
      const app = await start();
      const as = await asAdmin(app);
      const hana = await user({ username: 'hana' });
      await query(
        pool(),
        `INSERT INTO password_resets (user_id, token_hash, origin, expires_at)
         VALUES ($1, $2, 'email', now() + interval '1 hour')`,
        [hana.id, tokenHash(1)],
      );
      await as('POST', `/admin/users/${hana.id}/temporary-password`, {
        password: 'temporary pass 1',
      });
      const open = await queryOne<{ n: number }>(
        pool(),
        `SELECT count(*) AS n FROM password_resets WHERE used_at IS NULL`,
      );
      expect(open!.n).toBe(0);
    });

    it('sets a temporary password that must be changed', async () => {
      const app = await start();
      const as = await asAdmin(app);
      const hana = await user({ username: 'hana' });
      const response = await as('POST', `/admin/users/${hana.id}/temporary-password`, {
        password: 'temporary pass 1',
      });
      expect(response.statusCode).toBe(204);
      const row = await queryOne<{ must: boolean; days: number }>(
        pool(),
        `SELECT must_change_password AS must,
                round(extract(epoch FROM password_expires_at - now()) / 86400)::int AS days
           FROM users WHERE id = $1`,
        [hana.id],
      );
      expect(row).toEqual({ must: true, days: 7 });
      await signIn(app, 'hana', 'temporary pass 1');
      expectError(
        await as('POST', '/admin/users/999/temporary-password', { password: 'temporary pass 1' }),
        404,
        'not_found',
      );
    });
  });

  describe('password reset by email (FR-005, IF-10)', () => {
    it('returns a clear error code when no SMTP server is configured', async () => {
      const app = await start();
      await user({ username: 'hana' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-reset',
        payload: { identifier: 'hana' },
      });
      expectError(response, 503, 'service_unavailable');
      expect(response.json().error.details).toEqual({ reason: 'email_not_configured' });
    });

    it('emails invite and reset links through the configured SMTP server', async () => {
      const smtp = await startSmtp();
      try {
        const app = await start({
          SMTP_HOST: '127.0.0.1',
          SMTP_PORT: String(smtp.port),
          SMTP_FROM: 'manabi@example.com',
        });
        const as = await asAdmin(app);

        const created = (await as('POST', '/admin/invites', { email: 'kenji@example.com' })).json();
        expect(created.emailed).toBe(true);
        expect(smtp.received).toHaveLength(1);
        expect(smtp.received[0]!.to).toEqual(['kenji@example.com']);
        expect(smtp.received[0]!.text).toContain(created.link);

        const hana = await user({ username: 'hana', email: 'hana@example.com' });
        const oldCookie = await signIn(app, 'hana');
        const reset = (identifier: string) =>
          app.inject({
            method: 'POST',
            url: '/api/v1/auth/password-reset',
            payload: { identifier },
          });
        // Unknown accounts get the same answer and no email.
        expect((await reset('nobody@example.com')).statusCode).toBe(202);
        expect((await reset('HANA@example.com')).statusCode).toBe(202);
        await waitFor(() => smtp.received.length === 2);
        expect(smtp.received[1]!.to).toEqual(['hana@example.com']);
        const token = /\/reset-password\?token=([A-Za-z0-9_-]{43})/.exec(
          smtp.received[1]!.text,
        )![1];
        const stored = await queryOne<{ token_hash: string }>(
          pool(),
          `SELECT token_hash FROM password_resets WHERE user_id = $1`,
          [hana.id],
        );
        expect(stored!.token_hash).not.toContain(token);

        const confirm = (newPassword: string) =>
          app.inject({
            method: 'POST',
            url: '/api/v1/auth/password-reset/confirm',
            payload: { token, newPassword },
          });
        expectError(await confirm('password123'), 400, 'validation_failed');
        expect((await confirm('a brand new secret')).statusCode).toBe(204);
        // Single use, and every old session is gone.
        const again = await confirm('another new secret');
        expectError(again, 404, 'not_found');
        expect(again.json().error.details).toEqual({ reason: 'used' });
        const meOld = await app.inject({
          method: 'GET',
          url: '/api/v1/me',
          cookies: { [SESSION_COOKIE]: oldCookie },
        });
        expectError(meOld, 401, 'unauthenticated');
        await signIn(app, 'hana', 'a brand new secret');
      } finally {
        smtp.stop();
      }
    });

    it('refuses an expired reset token', async () => {
      const smtp = await startSmtp();
      try {
        const app = await start({
          SMTP_HOST: '127.0.0.1',
          SMTP_PORT: String(smtp.port),
          SMTP_FROM: 'manabi@example.com',
        });
        await user({ username: 'hana', email: 'hana@example.com' });
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/password-reset',
          payload: { identifier: 'hana' },
        });
        await waitFor(() => smtp.received.length === 1);
        const token = /token=([A-Za-z0-9_-]{43})/.exec(smtp.received[0]!.text)![1];
        await query(
          pool(),
          `UPDATE password_resets SET created_at = now() - interval '2 hours',
                                      expires_at = now() - interval '1 hour'`,
        );
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/password-reset/confirm',
          payload: { token, newPassword: 'a brand new secret' },
        });
        expectError(response, 404, 'not_found');
        expect(response.json().error.details).toEqual({ reason: 'expired' });
      } finally {
        smtp.stop();
      }
    });
  });

  describe('imports (FR-226)', () => {
    let worker: RunningWorker | undefined;

    beforeEach(async () => {
      await query(pool(), `DELETE FROM ${BOSS_SCHEMA}.job`).catch(() => undefined);
    });

    afterEach(async () => {
      await worker?.stop();
      worker = undefined;
    });

    it('starting an import enqueues a job and its run appears in the list', async () => {
      const app = await start({ DATABASE_URL: testDatabaseUrl() });
      const as = await asAdmin(app);

      expectError(
        await as('POST', '/admin/imports', {
          importer: 'jmdict',
          courseKey: 'ja-en',
          file: '../../etc/passwd',
        }),
        400,
        'validation_failed',
      );

      const started = await as('POST', '/admin/imports', {
        importer: 'jmdict',
        courseKey: 'ja-en',
        file: 'jmdict/missing',
      });
      expect(started.statusCode).toBe(202);
      expect(started.json().jobId).toEqual(expect.any(String));
      const job = await queryOne<{ name: string; data: object }>(
        pool(),
        `SELECT name, data FROM ${BOSS_SCHEMA}.job WHERE id = $1`,
        [started.json().jobId],
      );
      expect(job).toEqual({
        name: 'import-jmdict',
        data: { courseKey: 'ja-en', file: 'jmdict/missing' },
      });

      worker = await startWorker({
        databaseUrl: testDatabaseUrl(),
        jobs: [importJmdictJob],
        log: quietLog(),
        pollingIntervalSeconds: 0.5,
      });
      let runs: { importer: string; status: string }[] = [];
      await waitFor(async () => {
        runs = (await as('GET', '/admin/imports')).json().runs;
        return runs.length > 0 && runs[0]!.status !== 'running';
      });
      // The file does not exist, so the run is recorded as failed.
      expect(runs[0]).toMatchObject({ importer: 'jmdict', status: 'failed' });
    });
  });
});

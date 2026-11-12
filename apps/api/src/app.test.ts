import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { apiErrorSchema, z } from '@manabi/core';
import { AppError } from './errors';
import { API_PREFIX, missingRequestSchemas } from './routeSchemas';
import { testApp } from './test/app';
import type { TestApp } from './test/app';
import { describeWithDb, useTestDatabase } from './test/db';

let current: TestApp | undefined;
afterEach(async () => {
  await current?.close();
  current = undefined;
});

async function start(options: Parameters<typeof testApp>[0] = {}): Promise<TestApp> {
  current = await testApp(options);
  return current;
}

// FR-203
describeWithDb('GET /api/v1/healthz with a database', () => {
  const pool = useTestDatabase();

  it('returns 200 with the API and database ok', async () => {
    const { app } = await start({ pool: pool() });
    const response = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', api: 'ok', database: 'ok' });
  });
});

describe('GET /api/v1/healthz', () => {
  it('returns 503 in the error shape when the database is unreachable', async () => {
    const { app } = await start();
    const response = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: 'service_unavailable',
        message: 'Database unavailable',
        details: { api: 'ok', database: 'unavailable' },
      },
    });
  });

  it('needs no authentication', async () => {
    const { app } = await start();
    const response = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
    expect(response.statusCode).not.toBe(401);
  });
});

// NFR-13, IF-07
describe('request validation', () => {
  async function appWithItemRoute(): Promise<TestApp> {
    const t = await start();
    t.app.withTypeProvider<ZodTypeProvider>().post(
      '/api/v1/test/items/:id',
      {
        schema: {
          params: z.object({ id: z.coerce.number().int().positive() }),
          querystring: z.object({ limit: z.coerce.number().int().max(5).optional() }),
          body: z.object({ name: z.string().min(1) }),
        },
      },
      async (request) => ({ id: request.params.id, name: request.body.name }),
    );
    return t;
  }

  it('passes valid input through, coerced', async () => {
    const { app } = await appWithItemRoute();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test/items/7?limit=2',
      payload: { name: 'ねこ' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: 7, name: 'ねこ' });
  });

  it.each([
    ['body', '/api/v1/test/items/7', { name: '' }, 'body', ['name']],
    ['query', '/api/v1/test/items/7?limit=99', { name: 'a' }, 'querystring', ['limit']],
    ['path params', '/api/v1/test/items/abc', { name: 'a' }, 'params', ['id']],
  ])(
    'rejects an invalid %s with 400 validation_failed',
    async (_l, url, payload, location, path) => {
      const { app } = await appWithItemRoute();
      const response = await app.inject({ method: 'POST', url, payload });
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(apiErrorSchema.safeParse(body).success).toBe(true);
      expect(body.error.code).toBe('validation_failed');
      expect(body.error.details).toEqual([expect.objectContaining({ location, path })]);
    },
  );

  it('rejects malformed JSON with 400 bad_request', async () => {
    const { app } = await appWithItemRoute();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test/items/7',
      headers: { 'content-type': 'application/json' },
      payload: '{"name":',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('bad_request');
  });
});

// IF-07: every error uses the one shape, with a code from the core enum.
describe('error handler', () => {
  it.each([
    [
      'a framework error with its own code',
      Object.assign(new Error('too big'), {
        statusCode: 413,
        code: 'FST_ERR_CTP_BODY_TOO_LARGE',
      }),
      413,
      { error: { code: 'payload_too_large', message: 'too big', details: null } },
    ],
    [
      'an unexpected error',
      new Error('database exploded at 10.0.0.5'),
      500,
      { error: { code: 'internal_error', message: 'Internal server error', details: null } },
    ],
    [
      'a framework 503',
      Object.assign(new Error('closing'), { statusCode: 503 }),
      503,
      { error: { code: 'service_unavailable', message: 'Service unavailable', details: null } },
    ],
    [
      'a missing session',
      new AppError('unauthenticated', 'Sign in first'),
      401,
      { error: { code: 'unauthenticated', message: 'Sign in first', details: null } },
    ],
    [
      'a wrong role',
      new AppError('forbidden', 'Admins only'),
      403,
      { error: { code: 'forbidden', message: 'Admins only', details: null } },
    ],
    [
      'a missing resource',
      new AppError('not_found', 'Course not found', { id: 3 }),
      404,
      { error: { code: 'not_found', message: 'Course not found', details: { id: 3 } } },
    ],
    [
      'an AppError with a 5xx code',
      new AppError('internal_error', 'Something broke'),
      500,
      { error: { code: 'internal_error', message: 'Something broke', details: null } },
    ],
  ])('maps %s to the API error shape', async (_label, thrown, status, body) => {
    const { app } = await start();
    app.get('/api/v1/test-error', { schema: { querystring: z.object({}) } }, async () => {
      throw thrown;
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/test-error' });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(body);
  });

  it('answers unknown API routes with 404 not_found', async () => {
    const { app } = await start();
    const response = await app.inject({ method: 'GET', url: '/api/v1/no-such-route' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'not_found', message: 'Route not found', details: null },
    });
  });
});

// NFR-13: unvalidated routes cannot be registered, and every registered route has its schemas.
describe('route schemas', () => {
  it.each([
    ['GET without a query schema', { method: 'GET', url: '/api/v1/x' }, ['querystring']],
    [
      'GET with a path parameter',
      { method: 'GET', url: '/api/v1/x/:id', schema: { querystring: {} } },
      ['params'],
    ],
    [
      'POST without schemas',
      { method: 'POST', url: '/api/v1/x/:id' },
      ['querystring', 'params', 'body'],
    ],
    [
      'PATCH in a method list',
      { method: ['GET', 'PATCH'], url: '/api/v1/x', schema: { querystring: {} } },
      ['body'],
    ],
    ['a route outside the API', { method: 'GET', url: '/*' }, []],
    [
      'DELETE with params',
      { method: 'DELETE', url: '/api/v1/x/:id', schema: { querystring: {}, params: {} } },
      [],
    ],
  ] as const)('reports %s', (_label, route, missing) => {
    expect(missingRequestSchemas(route as Parameters<typeof missingRequestSchemas>[0])).toEqual(
      missing,
    );
  });

  it('refuses to register an API route without schemas', async () => {
    const { app } = await start();
    expect(() => app.get('/api/v1/unvalidated', async () => 'x')).toThrow(
      /must declare Zod schemas for: querystring/,
    );
  });

  it('every registered API route declares its request schemas', async () => {
    const { app } = await start();
    await app.ready();
    const apiRoutes = app.registeredRoutes.filter((r) => r.url.startsWith(API_PREFIX));
    expect(apiRoutes.map((r) => r.url)).toEqual(
      expect.arrayContaining(['/api/v1/healthz', '/api/v1/openapi.json']),
    );
    for (const route of apiRoutes) {
      expect({ route: route.url, missing: missingRequestSchemas(route) }).toEqual({
        route: route.url,
        missing: [],
      });
    }
  });
});

// IF-05
describe('GET /api/v1/openapi.json', () => {
  it('lists every registered API route', async () => {
    const { app } = await start();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    expect(response.statusCode).toBe(200);
    const doc = response.json();
    expect(doc.openapi).toMatch(/^3\./);

    const expected = app.registeredRoutes
      .filter((r) => r.url.startsWith(API_PREFIX))
      .flatMap((r) => (Array.isArray(r.method) ? r.method : [r.method]).map((m) => [m, r.url]))
      .filter(([method]) => method !== 'HEAD')
      .map(([method, url]) => `${method!.toLowerCase()} ${url!.replace(/:(\w+)/g, '{$1}')}`);
    const listed = Object.entries(doc.paths as Record<string, Record<string, unknown>>).flatMap(
      ([path, ops]) => Object.keys(ops).map((m) => `${m} ${path}`),
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(listed.sort()).toEqual([...new Set(expected)].sort());
  });

  it('describes request and response schemas from Zod', async () => {
    const { app } = await start();
    await app.ready();
    const doc = (await app.inject({ method: 'GET', url: '/api/v1/openapi.json' })).json();
    const health = doc.paths['/api/v1/healthz'].get;
    expect(Object.keys(health.responses)).toEqual(expect.arrayContaining(['200', '503']));
  });
});

// IF-08, NFR-11, SDD section 11 (Headers)
describe('behind Nginx Proxy Manager', () => {
  async function seen(
    headers: Record<string, string>,
    env: NodeJS.ProcessEnv = {},
  ): Promise<{ protocol: string; ip: string }> {
    const { app } = await start({ env });
    let result = { protocol: '', ip: '' };
    app.addHook('onRequest', async (request) => {
      result = { protocol: request.protocol, ip: request.ip };
    });
    await app.inject({ method: 'GET', url: '/api/v1/healthz', headers });
    return result;
  }

  it('treats a request with X-Forwarded-Proto https as secure', async () => {
    const result = await seen({ 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.9' });
    expect(result).toEqual({ protocol: 'https', ip: '203.0.113.9' });
  });

  it('takes the client address Nginx Proxy Manager saw, not one the client prepended', async () => {
    const result = await seen({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' });
    expect(result.ip).toBe('203.0.113.9');
  });

  it('trusts any number of hops when TRUST_PROXY=true', async () => {
    const result = await seen(
      { 'x-forwarded-for': '1.2.3.4, 203.0.113.9' },
      { TRUST_PROXY: 'true' },
    );
    expect(result.ip).toBe('1.2.3.4');
  });

  it('treats a request without forwarded headers as plain http', async () => {
    expect((await seen({})).protocol).toBe('http');
  });

  it('ignores forwarded headers from peers that are not trusted', async () => {
    const result = await seen({ 'x-forwarded-proto': 'https' }, { TRUST_PROXY: '10.0.0.2' });
    expect(result.protocol).toBe('http');
  });

  it('sets the security headers on every response', async () => {
    const { app } = await start();
    const response = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
    const csp = String(response.headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(response.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    // Outside production plain http must keep working (troubleshooting at http://<lxc-ip>:3000).
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('asks browsers to upgrade insecure requests in production', async () => {
    const { app } = await start({
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'silent',
        DATABASE_URL: 'postgres://manabi:manabi@127.0.0.1:1/manabi',
        SESSION_SECRET: 'x'.repeat(64),
        PUBLIC_URL: 'https://manabi.example.com',
      },
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
    expect(String(response.headers['content-security-policy'])).toContain(
      'upgrade-insecure-requests',
    );
  });
});

describe('logging', () => {
  it('writes JSON lines without headers, query strings or client addresses', async () => {
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk, _enc, done) {
        lines.push(...String(chunk).split('\n').filter(Boolean));
        done();
      },
    });
    const { app } = await start({ env: { LOG_LEVEL: 'info' }, logStream });
    app.get('/api/v1/test-log', { schema: { querystring: z.object({}) } }, async (request) => {
      request.log.info({ password: 'hunter2hunter2', user: { token: 'tok-123' } }, 'payload');
      const dbError = Object.assign(new Error('duplicate key'), {
        detail: 'Key (email)=(kana@example.com) already exists.',
      });
      request.log.error({ err: dbError }, 'insert failed');
      return { ok: true };
    });
    await app.inject({
      method: 'GET',
      url: '/api/v1/test-log?q=private-search',
      headers: {
        authorization: 'Bearer sekrit',
        cookie: 'session=sekrit',
        'x-forwarded-for': '198.51.100.4',
      },
    });

    expect(lines.length).toBeGreaterThan(0);
    const records = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(records.some((r) => (r.req as { path?: string })?.path === '/api/v1/test-log')).toBe(
      true,
    );
    const all = lines.join('\n');
    for (const secret of [
      'sekrit',
      'private-search',
      '198.51.100.4',
      'hunter2',
      'tok-123',
      'kana@example.com',
    ]) {
      expect(all).not.toContain(secret);
    }
  });
});

describe('serving the web app', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'manabi-web-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Manabi</title>');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('falls back to index.html for client-side routes', async () => {
    const { app } = await start({ env: { WEB_DIST_DIR: dir } });
    const response = await app.inject({ method: 'GET', url: '/learn/unit/1' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<title>Manabi</title>');
  });

  it('still answers unknown API routes with JSON', async () => {
    const { app } = await start({ env: { WEB_DIST_DIR: dir } });
    const response = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('not_found');
  });
});

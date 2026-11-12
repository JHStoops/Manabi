import { buildApp } from './app';
import { loadConfig } from './config';

describe('GET /api/v1/healthz', () => {
  it('returns status ok', async () => {
    const app = await buildApp(loadConfig({ NODE_ENV: 'test' }));
    const response = await app.inject({ method: 'GET', url: '/api/v1/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
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
      new Error('database exploded'),
      500,
      { error: { code: 'internal_error', message: 'Internal server error', details: null } },
    ],
  ])('maps %s to the API error shape', async (_label, thrown, status, body) => {
    const app = await buildApp(loadConfig({ NODE_ENV: 'test' }));
    app.get('/api/v1/test-error', async () => {
      throw thrown;
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/test-error' });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual(body);
    await app.close();
  });
});

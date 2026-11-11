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

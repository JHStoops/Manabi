import { buildApp } from './app';
import { loadConfig } from './config';
import { createPool } from './db/pool';

/** Never connected to: building the app and its OpenAPI document runs no queries. */
const UNUSED_DATABASE_URL = 'postgres://unused@127.0.0.1:1/unused';

/**
 * IF-05: the OpenAPI document of every /api/v1 route, built in-process without a database or a
 * listening socket. The configuration is fixed (not read from the environment) so the document,
 * and the client generated from it (packages/api-client), do not depend on where it runs.
 */
export async function buildOpenApiDocument(): Promise<Record<string, unknown>> {
  const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
  const pool = createPool(UNUSED_DATABASE_URL, () => {});
  const app = await buildApp({ config, pool });
  try {
    await app.ready();
    return app.swagger() as unknown as Record<string, unknown>;
  } finally {
    await app.close();
    await pool.end();
  }
}

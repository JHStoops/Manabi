import type { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { TtsProvider } from '@manabi/core';
import { buildApp } from '../app';
import type { Config } from '../config';
import { loadConfig } from '../config';
import { createPool } from '../db/pool';

/** A URL nothing listens on: queries fail at once with ECONNREFUSED. */
export const DEAD_DATABASE_URL = 'postgres://manabi:manabi@127.0.0.1:1/manabi';

export interface TestApp {
  app: FastifyInstance;
  /** Closes the app and ends the pool it was built with (unless the pool was passed in). */
  close: () => Promise<void>;
}

/**
 * Builds the app for a test. Without a `pool` it gets one on an unreachable database, which is
 * enough for every route that does not touch the database. The app is not ready yet, so tests
 * may still add routes and hooks.
 */
export async function testApp(
  options: { env?: NodeJS.ProcessEnv; pool?: Pool; logStream?: Writable; tts?: TtsProvider } = {},
): Promise<TestApp> {
  const config: Config = loadConfig({ NODE_ENV: 'test', ...options.env });
  const pool = options.pool ?? createPool(DEAD_DATABASE_URL, () => {});
  const app = await buildApp({ config, pool, logStream: options.logStream, tts: options.tts });
  return {
    app,
    close: async () => {
      await app.close();
      if (!options.pool) await pool.end();
    },
  };
}

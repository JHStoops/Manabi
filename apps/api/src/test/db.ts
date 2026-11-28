import type { Pool } from 'pg';
import { createPool } from '../db/pool';
import { BASE_ENV, withDatabase, workerDatabaseName } from './testDatabase';

/**
 * Helpers for integration tests that need PostgreSQL. Use `describeWithDb` instead of
 * `describe`, then `useTestDatabase()` inside it: it opens a pool on this worker's migrated
 * database, empties every table before each test, and closes the pool afterwards.
 */

/** True when global setup created test databases (DATABASE_URL was set). */
export const hasTestDatabase = Boolean(process.env[BASE_ENV]);

/** `describe` when a test database exists, otherwise `describe.skip`. */
export const describeWithDb: jest.Describe = hasTestDatabase ? describe : describe.skip;

/** Connection string of this Jest worker's test database. */
export function testDatabaseUrl(): string {
  const base = process.env[BASE_ENV];
  const adminUrl = process.env.DATABASE_URL;
  if (!base || !adminUrl) throw new Error('No test database: is DATABASE_URL set?');
  return withDatabase(adminUrl, workerDatabaseName(base, process.env.JEST_WORKER_ID ?? '1'));
}

// Empties every table except the migration bookkeeping and the reference data migrations seed
// (the achievement definitions, migration 0015), resetting identity sequences. Only the `public`
// schema: pg-boss's own schema (jobs/boss.ts) is left to pg-boss.
// The append-only tables (review_log, xp_events) reject TRUNCATE unless manabi.allow_truncate
// holds the current transaction id (migration 0003); the DO block runs as one transaction.
const TRUNCATE_ALL = `
DO $$
DECLARE tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO tables
    FROM pg_tables
   WHERE schemaname = 'public' AND tablename NOT IN ('pgmigrations', 'achievements');
  IF tables IS NOT NULL THEN
    PERFORM set_config('manabi.allow_truncate', pg_current_xact_id()::text, true);
    EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
  END IF;
END $$`;

export async function truncateAll(pool: Pool): Promise<void> {
  await pool.query(TRUNCATE_ALL);
}

/** Registers hooks and returns a getter for the pool (valid inside tests). */
export function useTestDatabase(): () => Pool {
  let pool: Pool | undefined;
  beforeAll(() => {
    pool = createPool(testDatabaseUrl());
  });
  beforeEach(async () => {
    await truncateAll(pool!);
  });
  afterAll(async () => {
    await pool?.end();
  });
  return () => {
    if (!pool) throw new Error('Test pool used outside a test');
    return pool;
  };
}

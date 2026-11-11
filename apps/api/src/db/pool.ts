import { Pool } from 'pg';

/** Creates the shared pg connection pool. All SQL is hand-written and parameterized. */
export function createPool(databaseUrl: string): Pool {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  return new Pool({ connectionString: databaseUrl });
}

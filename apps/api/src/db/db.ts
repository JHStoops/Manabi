import type { Pool, PoolClient, QueryResultRow } from 'pg';

/**
 * Anything that can run a query: the pool, or a client inside a transaction.
 * Functions in `queries.ts` files take a `Queryable` so they work in and out of transactions.
 */
export type Queryable = Pick<Pool | PoolClient, 'query'>;

/**
 * Runs one parameterized statement and returns its rows typed as `R`.
 * `sql` must be a constant string from a `queries.ts` file; values go in `params` only.
 */
export async function query<R extends QueryResultRow>(
  db: Queryable,
  sql: string,
  params: readonly unknown[] = [],
): Promise<R[]> {
  const result = await db.query<R>(sql, params as unknown[]);
  return result.rows;
}

/** Like `query`, but returns the first row, or null when there is none. */
export async function queryOne<R extends QueryResultRow>(
  db: Queryable,
  sql: string,
  params: readonly unknown[] = [],
): Promise<R | null> {
  const rows = await query<R>(db, sql, params);
  return rows[0] ?? null;
}

/**
 * Runs `fn` inside one transaction on a dedicated client. Commits when `fn` resolves;
 * rolls back and rethrows when it throws. Progress writes go through this (atomic writes).
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let releaseError: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // The connection is in an unknown state; destroy it instead of returning it to the pool.
      releaseError = rollbackErr as Error;
    }
    throw err;
  } finally {
    client.release(releaseError);
  }
}

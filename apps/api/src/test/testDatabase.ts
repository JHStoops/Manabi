import { Client } from 'pg';

/**
 * Shared naming for the integration-test databases. Each test run gets a unique base name;
 * Jest global setup migrates a template database once and clones one database per worker
 * from it, so test files running in parallel never truncate each other's rows.
 */

/** Env var carrying this run's database base name from global setup to the workers. */
export const BASE_ENV = 'MANABI_TEST_DB_BASE';

export function newBaseName(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `manabi_run_${stamp}_${rand}`;
}

export function templateName(base: string): string {
  return `${base}_tmpl`;
}

export function workerDatabaseName(base: string, workerId: string): string {
  if (!/^\d+$/.test(workerId)) throw new Error(`Unexpected JEST_WORKER_ID ${workerId}`);
  return `${base}_w${workerId}`;
}

/** Same server and credentials as `url`, different database. */
export function withDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

// Database names are generated above (letters, digits, underscores only); identifiers cannot be
// bound as parameters, so they are checked and quoted here instead.
function ident(name: string): string {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Unsafe database name ${name}`);
  return `"${name}"`;
}

export async function withAdminClient<T>(
  adminUrl: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function createDatabase(client: Client, name: string, template?: string) {
  await client.query(
    `CREATE DATABASE ${ident(name)}${template ? ` TEMPLATE ${ident(template)}` : ''}`,
  );
}

export async function dropDatabase(client: Client, name: string) {
  await client.query(`DROP DATABASE IF EXISTS ${ident(name)} WITH (FORCE)`);
}

export async function listRunDatabases(client: Client, base: string): Promise<string[]> {
  const result = await client.query<{ datname: string }>(
    `SELECT datname FROM pg_database WHERE starts_with(datname, $1)`,
    [`${base}_`],
  );
  return result.rows.map((r) => r.datname);
}

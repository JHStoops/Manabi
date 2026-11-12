import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runner } from 'node-pg-migrate';

/**
 * NFR-52: schema changes are numbered, forward-only SQL migrations in apps/api/migrations.
 * There is no down path: migrations have no `-- Down Migration` section and nothing here
 * migrates down. A bad migration is fixed by a new migration.
 */

/** Finds apps/api/migrations from source (src/db) or from the bundle (dist). */
export function defaultMigrationsDir(): string {
  const candidates = [resolve(__dirname, '../../migrations'), resolve(__dirname, '../migrations')];
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0]!;
}

export interface MigrateOptions {
  databaseUrl: string;
  dir?: string;
  /** Schema to migrate (created if missing); defaults to the connection's search_path. */
  schema?: string;
  /** Receives one line per applied migration and status messages. Defaults to silence. */
  log?: (message: string) => void;
}

// node-pg-migrate expects 13- or 17-digit timestamp prefixes and logs an error for our
// four-digit ones before falling back to numeric order, which is the order we want.
const ignoredMessage = /^Can't determine timestamp for \d+$/;

/** Applies all pending migrations in order. Returns the names applied (empty when up to date). */
export async function runMigrations(options: MigrateOptions): Promise<string[]> {
  if (!options.databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const log = options.log ?? (() => undefined);
  const emit = (msg: unknown): void => {
    const text = String(msg);
    if (!ignoredMessage.test(text)) log(text);
  };
  const applied = await runner({
    databaseUrl: options.databaseUrl,
    dir: options.dir ?? defaultMigrationsDir(),
    // Anchored by node-pg-migrate as ^(...)$: skip dotfiles and the README.
    ignorePattern: '(\\..*|.*\\.md)',
    migrationsTable: 'pgmigrations',
    ...(options.schema ? { schema: options.schema, createSchema: true } : {}),
    direction: 'up',
    count: Infinity,
    checkOrder: true,
    singleTransaction: true,
    logger: { debug: () => undefined, info: emit, warn: emit, error: emit },
  });
  return applied.map((m) => m.name);
}

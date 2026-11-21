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
  /**
   * How long to keep retrying while another process holds the migration lock (for example two
   * containers starting at once). Defaults to 30 seconds.
   */
  lockTimeoutMs?: number;
}

const LOCK_BUSY = 'Another migration is already running';
// node-pg-migrate's cleanup logs this after failing to take the lock (it never held it).
const UNLOCK_FAILED = 'Failed to release migration lock';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Applies all pending migrations in order. Returns the names applied (empty when up to date).
 * Waits with backoff while another process is migrating, and fails after `lockTimeoutMs`.
 */
export async function runMigrations(options: MigrateOptions): Promise<string[]> {
  if (!options.databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const log = options.log ?? (() => undefined);
  const deadline = Date.now() + (options.lockTimeoutMs ?? 30_000);
  let delay = 250;
  for (;;) {
    let unlockFailed = false;
    const emit = (msg: unknown): void => {
      const text = String(msg);
      if (text === UNLOCK_FAILED) unlockFailed = true;
      else log(text);
    };
    try {
      const applied = await runOnce(options, emit);
      if (unlockFailed) log(UNLOCK_FAILED);
      return applied;
    } catch (err) {
      // node-pg-migrate 9 appends ". Advisory lock mode is set to 'fail'.". No instanceof: under
      // Jest the error comes from Node's own realm (jest.node-pg-migrate.cjs).
      const busy = (err as Error | null)?.message?.startsWith(LOCK_BUSY) === true;
      if (!busy) {
        if (unlockFailed) log(UNLOCK_FAILED);
        throw err;
      }
      if (Date.now() + delay > deadline) {
        throw new Error(`${LOCK_BUSY}: gave up waiting for the migration lock`, { cause: err });
      }
      log(`${LOCK_BUSY}; retrying in ${delay} ms`);
      await sleep(delay);
      delay = Math.min(delay * 2, 4_000);
    }
  }
}

async function runOnce(options: MigrateOptions, emit: (msg: unknown) => void): Promise<string[]> {
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

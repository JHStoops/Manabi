import PgBoss from 'pg-boss';

/**
 * pg-boss keeps its queue in its own schema of the app database (SDD section 2), apart from the
 * tables our migrations own in `public`. It creates and upgrades that schema itself on start
 * (guarded against concurrent starts), so node-pg-migrate never sees it, and the test harness,
 * which only truncates `public`, leaves it alone.
 */
export const BOSS_SCHEMA = 'pgboss';

/**
 * - `worker`: fetches and runs jobs, runs cron schedules and pg-boss maintenance.
 * - `producer`: the API's instance. It only inserts jobs: no maintenance, no cron, and it never
 *   calls `work`, so the API process never runs a job.
 */
export type BossRole = 'worker' | 'producer';

/** Passed through to pg's Pool: a database that accepts but never answers fails instead of hanging. */
const CONNECTION_TIMEOUT_MS = 5000;

export function createBoss(databaseUrl: string, role: BossRole): PgBoss {
  const options: PgBoss.ConstructorOptions & { connectionTimeoutMillis: number } = {
    connectionString: databaseUrl,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    schema: BOSS_SCHEMA,
    application_name: `manabi-${role}`,
    // pg-boss opens its own small pool next to the app's pg pool.
    max: role === 'worker' ? 4 : 2,
    migrate: true,
    supervise: role === 'worker',
    schedule: role === 'worker',
  };
  return new PgBoss(options);
}

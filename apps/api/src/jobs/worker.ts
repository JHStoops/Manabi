import { createPool } from '../db/pool';
import type { Logger } from '../logger';
import { createBoss } from './boss';
import type { AnyJobDefinition } from './define';
import { registerJobs } from './define';

export interface WorkerOptions {
  databaseUrl: string;
  jobs: readonly AnyJobDefinition[];
  log: Logger;
  /** IANA zone for cron schedules; defaults to the process's zone (TZ). */
  timeZone?: string;
  /** How often idle queues are polled; default 2 seconds. */
  pollingIntervalSeconds?: number;
  /** How long `stop` lets running jobs finish before failing them (they are retried). */
  stopTimeoutMs?: number;
}

export interface RunningWorker {
  /** Stops fetching, waits for running jobs (up to the timeout), then closes all connections. */
  stop(): Promise<void>;
}

/**
 * Starts the background worker (SDD section 12, `worker` service): pg-boss on the app database
 * plus a pg pool for job handlers. Throws if the database is unreachable at start.
 */
export async function startWorker({
  databaseUrl,
  jobs,
  log,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  pollingIntervalSeconds = 2,
  // Below Docker's default 10 s stop grace period, so the worker closes before SIGKILL.
  stopTimeoutMs = 8000,
}: WorkerOptions): Promise<RunningWorker> {
  const pool = createPool(databaseUrl, (message, err) => log.error({ err }, message));
  const boss = createBoss(databaseUrl, 'worker');
  boss.on('error', (err: Error) => log.error({ err }, 'pg-boss error'));

  try {
    await boss.start();
    await registerJobs(boss, jobs, {
      context: { db: pool, log },
      timeZone,
      pollingIntervalSeconds,
    });
  } catch (err) {
    await boss.stop({ graceful: false }).catch(() => undefined);
    await pool.end();
    throw err;
  }

  log.info({ jobs: jobs.map((j) => j.name), timeZone }, 'worker started');

  let stopping: Promise<void> | undefined;
  return {
    stop() {
      stopping ??= (async () => {
        await boss.stop({ graceful: true, timeout: stopTimeoutMs });
        await pool.end();
        log.info('worker stopped');
      })();
      return stopping;
    },
  };
}

import type PgBoss from 'pg-boss';
import type { Logger } from '../logger';
import { createBoss } from './boss';

/** How long `enqueue` waits for the database before giving up, so a request never hangs on it. */
export const ENQUEUE_TIMEOUT_MS = 2000;

/**
 * The API's way to hand work to the worker. Jobs are rows in the pg-boss schema, so enqueuing
 * works whether or not a worker runs (NFR-23); a stopped worker picks them up when it starts.
 */
export interface JobQueue {
  /**
   * Sends a job and returns its id, or null when it could not be sent (no database configured,
   * database unreachable, timeout, unknown queue). Never throws, and settles within
   * `ENQUEUE_TIMEOUT_MS` once started. After a timeout the insert may still land.
   */
  enqueue(name: string, data?: object): Promise<string | null>;
  /** Connects ahead of the first `enqueue` (creating the pg-boss schema if needed). Never throws. */
  start(): Promise<boolean>;
  /** Closes the connection, if any. */
  stop(): Promise<void>;
}

export interface JobQueueOptions {
  /** Empty: enqueuing is disabled and always returns null (tests without a database). */
  databaseUrl: string;
  /** Queues to create on start, so sends to them never hit a missing queue. */
  queueNames: readonly string[];
  log: Logger;
  timeoutMs?: number;
}

/**
 * Creates the API's job queue. It is a pg-boss instance in the `producer` role: it never works
 * jobs, runs maintenance or cron. It connects lazily, so building the app needs no database, and
 * a failed connection is retried on the next call.
 */
export function createJobQueue({
  databaseUrl,
  queueNames,
  log,
  timeoutMs = ENQUEUE_TIMEOUT_MS,
}: JobQueueOptions): JobQueue {
  let ready: Promise<PgBoss> | null = null;
  let stopped = false;

  const connect = (): Promise<PgBoss> => {
    if (!ready) {
      const boss = createBoss(databaseUrl, 'producer');
      boss.on('error', (err: Error) => log.warn({ err }, 'job queue error'));
      const attempt: Promise<PgBoss> = (async () => {
        try {
          await boss.start();
          for (const name of queueNames) await boss.createQueue(name);
          return boss;
        } catch (err) {
          if (ready === attempt) ready = null;
          await boss.stop({ graceful: false }).catch(() => undefined);
          throw err;
        }
      })();
      ready = attempt;
    }
    return ready;
  };

  const withTimeout = async <T>(work: Promise<T>): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs);
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async enqueue(name, data = {}) {
      if (!databaseUrl || stopped) {
        log.warn({ job: name }, 'job queue disabled; job not sent');
        return null;
      }
      try {
        const id = await withTimeout(connect().then((boss) => boss.send(name, data)));
        if (!id) log.warn({ job: name }, 'job not sent: unknown queue');
        return id;
      } catch (err) {
        log.warn({ job: name, err }, 'job not sent');
        return null;
      }
    },

    async start() {
      if (!databaseUrl || stopped) return false;
      try {
        await connect();
        return true;
      } catch (err) {
        log.warn({ err }, 'job queue could not connect; will retry on the next enqueue');
        return false;
      }
    },

    async stop() {
      stopped = true;
      const pending = ready;
      ready = null;
      if (!pending) return;
      // A connection attempt still in progress settles within pg's connection timeout.
      const boss = await pending.catch(() => null);
      await boss?.stop({ graceful: false }).catch(() => undefined);
    },
  };
}

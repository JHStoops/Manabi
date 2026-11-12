import type PgBoss from 'pg-boss';
import type { Pool } from 'pg';
import type { Logger } from '../logger';

/** What a job handler gets besides its data. */
export interface JobContext {
  /** The worker's pg pool. Handlers call services; SQL stays in `queries.ts` files. */
  db: Pool;
  log: Logger;
}

/** Per-queue retry and timeout settings (pg-boss queue options). */
export interface JobQueueOptions {
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInSeconds?: number;
}

export interface JobDefinition<T extends object = object> {
  /** Queue name: lowercase letters, digits and hyphens. */
  name: string;
  /** Runs one job. Throwing fails the job, and pg-boss retries it per `queue`. */
  handler: (data: T, context: JobContext) => Promise<unknown>;
  /** Five-field cron expression; the worker sends the job on this schedule. */
  cron?: string;
  queue?: JobQueueOptions;
}

/** A queue's name and options: what the API needs to create a job's queue. */
export type QueueSpec = Pick<JobDefinition, 'name' | 'queue'>;

/** pg-boss queue options for a job, the same whichever process creates the queue first. */
export function queueOptions(job: QueueSpec): PgBoss.Queue {
  return { name: job.name, ...job.queue };
}

/** Any job definition, whatever its data type (for lists of jobs). */
export type AnyJobDefinition = JobDefinition<never>;

const JOB_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Declares a job. Validates the name at start-up rather than on the first send. */
export function defineJob<T extends object>(definition: JobDefinition<T>): JobDefinition<T> {
  if (!JOB_NAME.test(definition.name)) {
    throw new Error(`Job name ${definition.name} must be lowercase letters, digits and hyphens`);
  }
  return definition;
}

export interface RegisterOptions {
  context: JobContext;
  /** IANA zone for cron schedules (the TZ of the deployment). */
  timeZone: string;
  /** How often an idle queue is polled. */
  pollingIntervalSeconds: number;
}

/**
 * Creates each job's queue, starts a handler for it (one job at a time) and, for jobs with a
 * cron, upserts its schedule. A job that no longer has a cron has its schedule removed.
 */
export async function registerJobs(
  boss: PgBoss,
  jobs: readonly AnyJobDefinition[],
  { context, timeZone, pollingIntervalSeconds }: RegisterOptions,
): Promise<void> {
  for (const job of jobs) {
    // create_queue does nothing if the queue exists (for example the API created it first), so
    // the options are applied again to keep them in step with the definition.
    await boss.createQueue(job.name, queueOptions(job));
    await boss.updateQueue(job.name, queueOptions(job));
    await boss.work<object>(job.name, { batchSize: 1, pollingIntervalSeconds }, async ([item]) => {
      if (!item) return undefined;
      const log = context.log;
      const started = Date.now();
      log.info({ job: job.name, jobId: item.id }, 'job started');
      try {
        const result = await job.handler(item.data as never, context);
        log.info({ job: job.name, jobId: item.id, ms: Date.now() - started }, 'job completed');
        return result;
      } catch (err) {
        log.error({ job: job.name, jobId: item.id, err }, 'job failed');
        throw err;
      }
    });
    if (job.cron) {
      await boss.schedule(job.name, job.cron, {}, { tz: timeZone });
    } else {
      await boss.unschedule(job.name);
    }
  }
}

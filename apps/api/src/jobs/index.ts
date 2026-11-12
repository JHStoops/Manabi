import type { AnyJobDefinition } from './define';
import { purgeExpiredJob } from './purgeExpired';

/**
 * Every background job the worker runs. Imports, streak and leaderboard jobs are added here as
 * their issues land. Audio is not a job: the API generates a clip on first play.
 */
export const allJobs: readonly AnyJobDefinition[] = [purgeExpiredJob];

/** Queue names the API may enqueue to. */
export const jobNames: readonly string[] = allJobs.map((job) => job.name);

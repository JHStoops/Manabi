import { settleStreaks } from '../modules/stats/service';
import { defineJob } from './define';

/**
 * FR-164: resets the streak of learners who missed more days than they hold freezes (it never
 * spends freezes; the learner chooses, see chooseFreezes). Hourly, because a
 * learner's day ends at their own midnight; each run only touches learners whose day just ended.
 */
export const settleStreaksJob = defineJob<Record<string, never>>({
  name: 'settle-streaks',
  cron: '5 * * * *',
  queue: { retryLimit: 3, retryDelay: 300, expireInSeconds: 15 * 60 },
  handler: async (_data, { db, log }) => {
    const settled = await settleStreaks(db);
    log.info({ job: 'settle-streaks', settled }, 'settled streaks');
    return settled;
  },
});

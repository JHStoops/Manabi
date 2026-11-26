import { closeLastWeek } from '../modules/social/service';
import { defineJob } from './define';

/**
 * FR-181: closes the week at the end of Sunday 23:59 (server time zone) by storing final ranks
 * for the week that just ended; the top three are the profile badges. Idempotent per week.
 */
export const closeWeekJob = defineJob<Record<string, never>>({
  name: 'close-week',
  cron: '0 0 * * 1',
  queue: { retryLimit: 3, retryDelay: 300, expireInSeconds: 15 * 60 },
  handler: async (_data, { db, log }) => {
    const written = await closeLastWeek(db);
    log.info({ job: 'close-week', written }, 'closed week');
    return written;
  },
});

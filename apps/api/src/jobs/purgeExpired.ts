import { purgeExpired } from '../modules/retention/service';
import { defineJob } from './define';

/** DR-08: nightly purge of expired sessions, invites, reset tokens and lesson sessions. */
export const purgeExpiredJob = defineJob<Record<string, never>>({
  name: 'purge-expired',
  // 03:30 in the deployment's time zone (TZ).
  cron: '30 3 * * *',
  queue: { retryLimit: 3, retryDelay: 300, expireInSeconds: 15 * 60 },
  handler: async (_data, { db, log }) => {
    const deleted = await purgeExpired(db);
    log.info({ job: 'purge-expired', deleted }, 'purged expired rows');
    return deleted;
  },
});

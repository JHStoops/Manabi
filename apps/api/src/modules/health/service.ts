import type { HealthDetails } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { pingDatabase } from './queries';

/** How long the health check waits for the database before reporting it unavailable. */
export const DATABASE_CHECK_TIMEOUT_MS = 2000;

/**
 * FR-203: reports the API (up, since it is answering) and the database. A database that refuses,
 * errors or does not answer within the timeout is `unavailable`; this never throws.
 */
export async function checkHealth(
  db: Queryable,
  timeoutMs: number = DATABASE_CHECK_TIMEOUT_MS,
): Promise<HealthDetails> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    const ok = await Promise.race([pingDatabase(db).catch(() => false), timeout]);
    return { api: 'ok', database: ok ? 'ok' : 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

import type { Queryable } from '../../db/db';
import {
  deleteExpiredInvites,
  deleteExpiredLessonSessions,
  deleteExpiredPasswordResets,
  deleteExpiredSessions,
} from './queries';

export interface PurgeCounts {
  sessions: number;
  invites: number;
  passwordResets: number;
  lessonSessions: number;
}

/**
 * DR-08: deletes expired sessions, invites, reset tokens and lesson sessions. A row is expired
 * once `expires_at` is at or before `now` (default: the database clock).
 *
 * The four deletes are independent statements, not one transaction: no row in one table
 * depends on a row in another, so there is no partial state to protect, and a failure in one
 * table still lets the earlier ones finish. The job then fails and pg-boss retries it; running
 * the purge again is harmless.
 */
export async function purgeExpired(db: Queryable, now: Date | null = null): Promise<PurgeCounts> {
  return {
    sessions: await deleteExpiredSessions(db, now),
    invites: await deleteExpiredInvites(db, now),
    passwordResets: await deleteExpiredPasswordResets(db, now),
    lessonSessions: await deleteExpiredLessonSessions(db, now),
  };
}

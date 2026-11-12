import type { Queryable } from '../../db/db';

/**
 * DR-08: deletes rows whose `expires_at` has passed. `$1` is the cut-off; null means the
 * database clock. Each is one statement with its own implicit transaction, and none touches
 * the append-only tables (review_log, xp_events).
 */

async function deleteCount(db: Queryable, sql: string, now: Date | null): Promise<number> {
  const result = await db.query(sql, [now]);
  return result.rowCount ?? 0;
}

/** Signed-in devices past their 30-day sliding expiry (FR-003). Sign-out deletes at once. */
export function deleteExpiredSessions(db: Queryable, now: Date | null): Promise<number> {
  return deleteCount(
    db,
    'DELETE FROM sessions WHERE expires_at <= COALESCE($1::timestamptz, now())',
    now,
  );
}

/**
 * Invites past their expiry, whatever their state. Used and revoked invites stay until then so
 * the admin invite list (FR-002) can still show how each one ended.
 */
export function deleteExpiredInvites(db: Queryable, now: Date | null): Promise<number> {
  return deleteCount(
    db,
    'DELETE FROM invites WHERE expires_at <= COALESCE($1::timestamptz, now())',
    now,
  );
}

/** Reset links past their expiry, used or not (FR-005). */
export function deleteExpiredPasswordResets(db: Queryable, now: Date | null): Promise<number> {
  return deleteCount(
    db,
    'DELETE FROM password_resets WHERE expires_at <= COALESCE($1::timestamptz, now())',
    now,
  );
}

/**
 * Unfinished lesson sessions past their 24 hours (FR-050). Completing a session deletes it in the
 * completion transaction, so only abandoned ones are left for the purge.
 */
export function deleteExpiredLessonSessions(db: Queryable, now: Date | null): Promise<number> {
  return deleteCount(
    db,
    'DELETE FROM lesson_sessions WHERE expires_at <= COALESCE($1::timestamptz, now())',
    now,
  );
}

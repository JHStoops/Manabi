import type { Queryable } from '../../db/db';
import { insertReturning, query, queryOne } from '../../db/db';
import type { ClientKind, Role } from '@manabi/core';
import type { InviteRow, PasswordResetOrigin, PasswordResetRow, SessionRow, UserRow } from './rows';

// Hand-written, parameterized SQL for the account tables. Every time comparison uses the
// database clock (now()), so expiry does not depend on the API host's clock.

export interface NewUser {
  username: string;
  email: string | null;
  /** Argon2id PHC string (NFR-10). */
  passwordHash: string;
  displayName: string;
  role: Role;
  timeZone: string;
  settings?: { [key: string]: unknown };
}

export function insertUser(db: Queryable, u: NewUser): Promise<UserRow> {
  return insertReturning<UserRow>(
    db,
    `INSERT INTO users (username, email, password_hash, display_name, role, time_zone, settings)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [u.username, u.email, u.passwordHash, u.displayName, u.role, u.timeZone, u.settings ?? {}],
  );
}

/**
 * DR-07: deletes the account. Foreign keys remove the user's sessions, progress, logs, notes,
 * follows and nudges (ON DELETE CASCADE) and anonymize their answer reports (SET NULL).
 * Returns whether a row was deleted.
 */
export async function deleteUser(db: Queryable, id: number): Promise<boolean> {
  const rows = await query<{ id: number }>(db, `DELETE FROM users WHERE id = $1 RETURNING id`, [
    id,
  ]);
  return rows.length > 0;
}

/** A user row plus whether its temporary password has expired (FR-005). */
export interface UserWithExpiry extends UserRow {
  password_expired: boolean;
}

const USER_WITH_EXPIRY = `u.*, (u.password_expires_at IS NOT NULL
                                 AND u.password_expires_at <= now()) AS password_expired`;

/**
 * FR-003: the account a sign-in names, by username or email, ignoring case. A username cannot
 * contain '@' and an email must, so at most one account matches.
 */
export function findUserByLogin(db: Queryable, identifier: string): Promise<UserWithExpiry | null> {
  return queryOne<UserWithExpiry>(
    db,
    `SELECT ${USER_WITH_EXPIRY}
       FROM users u
      WHERE lower(u.username) = lower($1) OR lower(u.email) = lower($1)
      LIMIT 1`,
    [identifier],
  );
}

export function findUserById(db: Queryable, id: number): Promise<UserWithExpiry | null> {
  return queryOne<UserWithExpiry>(db, `SELECT ${USER_WITH_EXPIRY} FROM users u WHERE u.id = $1`, [
    id,
  ]);
}

/** Replaces the hash only (a rehash with current Argon2 parameters at sign-in). */
export async function updatePasswordHash(db: Queryable, userId: number, hash: string) {
  await query(db, `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [
    userId,
    hash,
  ]);
}

/** FR-005: a password the user chose; clears any temporary-password state. */
export async function setChosenPassword(db: Queryable, userId: number, hash: string) {
  await query(
    db,
    `UPDATE users
        SET password_hash = $2, must_change_password = false, password_expires_at = NULL,
            updated_at = now()
      WHERE id = $1`,
    [userId, hash],
  );
}

/**
 * FR-005: an admin-set temporary password, which must be changed at the next sign-in and stops
 * working after `ttlDays`. Returns whether the user exists.
 */
export async function setTemporaryPassword(
  db: Queryable,
  userId: number,
  hash: string,
  ttlDays: number,
): Promise<boolean> {
  const rows = await query<{ id: number }>(
    db,
    `UPDATE users
        SET password_hash = $2, must_change_password = true,
            password_expires_at = now() + make_interval(days => $3), updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [userId, hash, ttlDays],
  );
  return rows.length > 0;
}

// Sessions (FR-003, FR-004)

export function insertSession(
  db: Queryable,
  s: { userId: number; tokenHash: string; clientKind: ClientKind; ttlDays: number },
): Promise<SessionRow> {
  return insertReturning<SessionRow>(
    db,
    `INSERT INTO sessions (user_id, token_hash, client_kind, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(days => $4))
     RETURNING *`,
    [s.userId, s.tokenHash, s.clientKind, s.ttlDays],
  );
}

/** An unexpired session with its user, and whether its last-seen time is older than the throttle. */
export interface SessionWithUser extends UserWithExpiry {
  session_id: number;
  client_kind: ClientKind;
  session_expires_at: Date;
  /** True when last_seen_at is older than the touch interval, so the expiry should slide. */
  stale: boolean;
}

export function findActiveSession(
  db: Queryable,
  tokenHash: string,
  touchIntervalSeconds: number,
): Promise<SessionWithUser | null> {
  return queryOne<SessionWithUser>(
    db,
    `SELECT ${USER_WITH_EXPIRY},
            s.id AS session_id, s.client_kind, s.expires_at AS session_expires_at,
            s.last_seen_at < now() - make_interval(secs => $2) AS stale
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash, touchIntervalSeconds],
  );
}

/** FR-003: slides the 30-day expiry forward from now. Returns the new expiry. */
export async function touchSession(db: Queryable, id: number, ttlDays: number): Promise<Date> {
  const row = await insertReturning<{ expires_at: Date }>(
    db,
    `UPDATE sessions SET last_seen_at = now(), expires_at = now() + make_interval(days => $2)
      WHERE id = $1
      RETURNING expires_at`,
    [id, ttlDays],
  );
  return row.expires_at;
}

/** FR-004: the user's unexpired sessions, most recently used first. */
export function listSessions(db: Queryable, userId: number): Promise<SessionRow[]> {
  return query<SessionRow>(
    db,
    `SELECT * FROM sessions
      WHERE user_id = $1 AND expires_at > now()
      ORDER BY last_seen_at DESC, id DESC`,
    [userId],
  );
}

/** FR-004, NFR-14: deletes one of the user's own sessions. Returns whether it existed. */
export async function deleteSession(db: Queryable, userId: number, id: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    db,
    `DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId],
  );
  return rows.length > 0;
}

/** Ends the session a token belongs to, if any. */
export async function deleteSessionByTokenHash(db: Queryable, tokenHash: string): Promise<void> {
  await query(db, `DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
}

/** SDD section 11: every session of the user ends (password change, disabling, reset). */
export async function deleteSessionsOfUser(db: Queryable, userId: number): Promise<number> {
  const rows = await query<{ id: number }>(
    db,
    `DELETE FROM sessions WHERE user_id = $1 RETURNING id`,
    [userId],
  );
  return rows.length;
}

// Invites (FR-001, FR-002)

export function insertInvite(
  db: Queryable,
  i: {
    tokenHash: string;
    email: string | null;
    role: Role;
    createdBy: number | null;
    ttlDays: number;
  },
): Promise<InviteRow> {
  return insertReturning<InviteRow>(
    db,
    `INSERT INTO invites (token_hash, email, role, created_by, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))
     RETURNING *`,
    [i.tokenHash, i.email, i.role, i.createdBy, i.ttlDays],
  );
}

/** An invite plus whether it has expired, locked until the transaction ends. */
export interface InviteWithExpiry extends InviteRow {
  expired: boolean;
}

export function findInviteForUpdate(
  db: Queryable,
  tokenHash: string,
): Promise<InviteWithExpiry | null> {
  return queryOne<InviteWithExpiry>(
    db,
    `SELECT *, expires_at <= now() AS expired FROM invites WHERE token_hash = $1 FOR UPDATE`,
    [tokenHash],
  );
}

export async function markInviteUsed(db: Queryable, id: number, userId: number) {
  await query(db, `UPDATE invites SET used_by = $2, used_at = now() WHERE id = $1`, [id, userId]);
}

// Password resets (FR-005)

export function insertPasswordReset(
  db: Queryable,
  r: { userId: number; tokenHash: string; origin: PasswordResetOrigin; ttlMinutes: number },
): Promise<PasswordResetRow> {
  return insertReturning<PasswordResetRow>(
    db,
    `INSERT INTO password_resets (user_id, token_hash, origin, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4))
     RETURNING *`,
    [r.userId, r.tokenHash, r.origin, r.ttlMinutes],
  );
}

/** A reset token plus whether it has expired, locked until the transaction ends. */
export interface PasswordResetWithExpiry extends PasswordResetRow {
  expired: boolean;
}

export function findPasswordResetForUpdate(
  db: Queryable,
  tokenHash: string,
): Promise<PasswordResetWithExpiry | null> {
  return queryOne<PasswordResetWithExpiry>(
    db,
    `SELECT *, expires_at <= now() AS expired FROM password_resets
      WHERE token_hash = $1 FOR UPDATE`,
    [tokenHash],
  );
}

/** Uses up every outstanding reset token of the user, so each link works once at most. */
export async function markPasswordResetsUsed(db: Queryable, userId: number): Promise<void> {
  await query(
    db,
    `UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`,
    [userId],
  );
}

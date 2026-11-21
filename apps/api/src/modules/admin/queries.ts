import type { Queryable } from '../../db/db';
import { query, queryOne } from '../../db/db';
import type { Role } from '@manabi/core';
import type { InviteRow, UserRow } from '../auth/rows';
import type { ImportRunRow } from './rows';

// Hand-written, parameterized SQL for the admin console (FR-002, FR-200, FR-226).

/** A user row with the streak cache the console shows (FR-200). */
export interface AdminUserRow extends UserRow {
  last_active_date: string | null;
  current_streak: number;
}

const ADMIN_USER = `SELECT u.*, s.last_active_date, COALESCE(s.current_streak, 0) AS current_streak
                      FROM users u LEFT JOIN user_stats s ON s.user_id = u.id`;

// shortcut: no pagination; a family server has tens of users. Page it if that ever grows.
export function listUsers(db: Queryable): Promise<AdminUserRow[]> {
  return query<AdminUserRow>(db, `${ADMIN_USER} ORDER BY lower(u.username)`);
}

export function findUser(db: Queryable, id: number): Promise<AdminUserRow | null> {
  return queryOne<AdminUserRow>(db, `${ADMIN_USER} WHERE u.id = $1`, [id]);
}

/**
 * FR-200: changes the role and/or disables or re-enables the account; a null leaves that field
 * as it is. Disabling keeps an earlier disabled_at. Returns whether the user exists.
 */
export async function updateUser(
  db: Queryable,
  id: number,
  change: { role: Role | null; disabled: boolean | null },
): Promise<boolean> {
  const rows = await query<{ id: number }>(
    db,
    `UPDATE users
        SET role = COALESCE($2, role),
            disabled_at = CASE WHEN $3::boolean IS NULL THEN disabled_at
                               WHEN $3 THEN COALESCE(disabled_at, now())
                               ELSE NULL END,
            updated_at = now()
      WHERE id = $1
      RETURNING id`,
    [id, change.role, change.disabled],
  );
  return rows.length > 0;
}

/** FR-200: the ids of the enabled admins, locked until the transaction ends. */
export async function lockEnabledAdmins(db: Queryable): Promise<number[]> {
  const rows = await query<{ id: number }>(
    db,
    `SELECT id FROM users WHERE role = 'admin' AND disabled_at IS NULL ORDER BY id FOR UPDATE`,
  );
  return rows.map((r) => r.id);
}

/** An invite plus whether it has expired. */
export interface InviteWithExpiry extends InviteRow {
  expired: boolean;
}

// shortcut: no pagination; the nightly purge deletes expired invites (DR-08), so the list stays short.
export function listInvites(db: Queryable): Promise<InviteWithExpiry[]> {
  return query<InviteWithExpiry>(
    db,
    `SELECT *, expires_at <= now() AS expired FROM invites ORDER BY created_at DESC, id DESC`,
  );
}

export function findInvite(db: Queryable, id: number): Promise<InviteRow | null> {
  return queryOne<InviteRow>(db, `SELECT * FROM invites WHERE id = $1`, [id]);
}

/** FR-002: revokes an unused invite (revoking twice keeps the first time). Returns whether it did. */
export async function revokeInvite(db: Queryable, id: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    db,
    `UPDATE invites SET revoked_at = COALESCE(revoked_at, now())
      WHERE id = $1 AND used_at IS NULL
      RETURNING id`,
    [id],
  );
  return rows.length > 0;
}

// shortcut: the latest 50 runs only; add cursor pagination if admins need older history.
export function listImportRuns(db: Queryable): Promise<ImportRunRow[]> {
  return query<ImportRunRow>(
    db,
    `SELECT * FROM import_runs ORDER BY started_at DESC, id DESC LIMIT 50`,
  );
}

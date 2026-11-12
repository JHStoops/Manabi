import type { Queryable } from '../../db/db';
import { insertReturning, query } from '../../db/db';
import type { Role } from '@manabi/core';
import type { UserRow } from './rows';

// Hand-written, parameterized SQL for the account tables. Sign-in, invite and session queries
// are added by the issues that need them.

export interface NewUser {
  username: string;
  email: string | null;
  /** Argon2id PHC string (NFR-10). */
  passwordHash: string;
  displayName: string;
  role: Role;
  timeZone: string;
}

export function insertUser(db: Queryable, u: NewUser): Promise<UserRow> {
  return insertReturning<UserRow>(
    db,
    `INSERT INTO users (username, email, password_hash, display_name, role, time_zone)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [u.username, u.email, u.passwordHash, u.displayName, u.role, u.timeZone],
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

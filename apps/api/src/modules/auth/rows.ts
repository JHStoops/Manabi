/**
 * Row types for the account tables (migration 0002, SDD section 5). Column names and the types
 * pg returns: int8 as number, timestamptz as Date, jsonb parsed.
 */

/** FR-006: the only two account types. */
export type Role = 'admin' | 'learner';
export type ClientKind = 'web' | 'mobile';
export type PasswordResetOrigin = 'email' | 'admin';

/** NFR-61: username, display name, email, time zone and settings are the only personal fields. */
export interface UserRow {
  id: number;
  username: string;
  email: string | null;
  /** NFR-10: an Argon2id PHC string, never a password. */
  password_hash: string;
  display_name: string;
  role: Role;
  must_change_password: boolean;
  /** Set with an admin-issued temporary password (FR-005). */
  password_expires_at: Date | null;
  /** IANA zone name. */
  time_zone: string;
  /** Shape validated by Zod in @manabi/core. */
  settings: { [key: string]: unknown };
  disabled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Token columns hold SHA-256 hex digests only (NFR-10). */
export interface InviteRow {
  id: number;
  token_hash: string;
  email: string | null;
  role: Role;
  created_by: number | null;
  created_at: Date;
  expires_at: Date;
  used_by: number | null;
  used_at: Date | null;
  revoked_at: Date | null;
}

export interface SessionRow {
  id: number;
  user_id: number;
  token_hash: string;
  client_kind: ClientKind;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
}

export interface PasswordResetRow {
  id: number;
  user_id: number;
  token_hash: string;
  origin: PasswordResetOrigin;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
}

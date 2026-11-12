import type { Pool } from 'pg';
import { learnerSettingsSchema } from '@manabi/core';
import type {
  AcceptInviteRequest,
  ChangePasswordRequest,
  ClientKind,
  LoginRequest,
  Role,
  Session,
  User,
} from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import type { AttemptLimiter } from '../../rateLimit';
import {
  passwordProblem,
  hashPassword,
  needsRehash,
  verifyDummyPassword,
  verifyPassword,
} from './passwords';
import * as q from './queries';
import type { InviteRow, SessionRow, UserRow } from './rows';
import { hashToken, newToken } from './tokens';

/** FR-003: a session lasts 30 days from its last use. */
export const SESSION_TTL_DAYS = 30;
/**
 * The sliding expiry moves at most once per this interval, so an active session costs one write
 * an hour rather than one per request. The expiry is therefore exact to within an hour.
 */
export const SESSION_TOUCH_INTERVAL_SECONDS = 60 * 60;
/** Product Spec section 11: invites expire after 7 days unless the admin picks otherwise. */
export const INVITE_TTL_DAYS = 7;
/** SDD section 11: an admin-set temporary password expires after 7 days. */
export const TEMP_PASSWORD_TTL_DAYS = 7;

declare const scopedUserIdBrand: unique symbol;

/**
 * NFR-14: the id of the user making the request, taken from their session. Services that read or
 * change one user's data take this type rather than a plain number, so an id from a path,
 * query or body cannot be passed by accident; only the auth guard creates one.
 */
export type ScopedUserId = number & { readonly [scopedUserIdBrand]: true };

/** Who is making a request: their session and account, as of this request. */
export interface AuthContext {
  userId: ScopedUserId;
  user: UserRow;
  sessionId: number;
  clientKind: ClientKind;
}

/** A newly issued session: the raw token goes to the client once and is never stored. */
export interface IssuedSession {
  user: User;
  token: string;
  clientKind: ClientKind;
}

/** The API shape of a user row (no password hash). */
export function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    mustChangePassword: row.must_change_password,
    timeZone: row.time_zone,
    settings: learnerSettingsSchema.parse(row.settings),
    disabledAt: row.disabled_at?.toISOString() ?? null,
  };
}

function toSession(row: SessionRow, currentId: number): Session {
  return {
    id: row.id,
    clientKind: row.client_kind,
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    current: row.id === currentId,
  };
}

/** NFR-12: records an attempt or refuses the request with 429. */
function limit(limiter: AttemptLimiter, keys: string[]): void {
  const result = limiter.attempt(keys);
  if (!result.allowed) {
    throw new AppError('rate_limited', 'Too many attempts; try again later', {
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}

/** SDD section 11: a new password must not be common or the username. Zod checks the length. */
function checkNewPassword(password: string, username: string, field: string): void {
  const problem = passwordProblem(password, username);
  if (problem) {
    throw new AppError('validation_failed', problem, [
      { location: 'body', path: [field], message: problem },
    ]);
  }
}

async function issueSession(
  db: Queryable,
  userId: number,
  clientKind: ClientKind,
): Promise<string> {
  const token = newToken();
  await q.insertSession(db, {
    userId,
    tokenHash: hashToken(token),
    clientKind,
    ttlDays: SESSION_TTL_DAYS,
  });
  return token;
}

const BAD_LOGIN = 'Wrong username, email or password';

/**
 * FR-003: signs in by username or email. Every failure takes about as long as checking a
 * password, so the response does not reveal whether the account exists. Only someone who gave
 * the right password learns that the account is disabled or its temporary password expired.
 */
export async function login(
  db: Queryable,
  limiter: AttemptLimiter,
  ip: string,
  body: LoginRequest,
): Promise<IssuedSession> {
  const user = await q.findUserByLogin(db, body.identifier);
  // NFR-12: per IP and per account; an unknown name is keyed by the name itself.
  const accountKey = user ? `user:${user.id}` : `name:${body.identifier.toLowerCase()}`;
  limit(limiter, [`login:ip:${ip}`, `login:${accountKey}`]);

  const ok = user
    ? await verifyPassword(user.password_hash, body.password)
    : await verifyDummyPassword(body.password);
  if (!user || !ok) throw new AppError('unauthenticated', BAD_LOGIN);
  if (user.disabled_at) {
    throw new AppError('unauthenticated', 'This account is disabled', {
      reason: 'account_disabled',
    });
  }
  if (user.password_expired) {
    throw new AppError('unauthenticated', 'This temporary password has expired', {
      reason: 'temporary_password_expired',
    });
  }
  if (needsRehash(user.password_hash)) {
    await q.updatePasswordHash(db, user.id, await hashPassword(body.password));
  }
  const token = await issueSession(db, user.id, body.clientKind);
  return { user: toUser(user), token, clientKind: body.clientKind };
}

function inviteProblem(invite: (InviteRow & { expired: boolean }) | null): string | null {
  if (!invite) return 'invalid';
  if (invite.revoked_at) return 'revoked';
  if (invite.used_at) return 'used';
  if (invite.expired) return 'expired';
  return null;
}

/** Unique indexes on users whose violation means the client chose a taken name or email. */
const TAKEN: Record<string, string> = {
  users_username_key: 'username',
  users_email_key: 'email',
};

/**
 * FR-001: creates an account from a valid, unexpired, unused, unrevoked invite, marks the invite
 * used and signs the new user in, all in one transaction. The invite row is locked, so two
 * requests with the same token cannot both succeed.
 */
export async function acceptInvite(
  pool: Pool,
  limiter: AttemptLimiter,
  ip: string,
  body: AcceptInviteRequest,
): Promise<IssuedSession> {
  limit(limiter, [`invite:ip:${ip}`, `invite:name:${body.username.toLowerCase()}`]);
  checkNewPassword(body.password, body.username, 'password');
  // Hashing takes tens of milliseconds; do it before the transaction locks the invite.
  const passwordHash = await hashPassword(body.password);

  return withTransaction(pool, async (client) => {
    const invite = await q.findInviteForUpdate(client, hashToken(body.token));
    const problem = inviteProblem(invite);
    if (problem || !invite) {
      throw new AppError('not_found', 'This invite link is not valid', { reason: problem });
    }
    let user: UserRow;
    try {
      user = await q.insertUser(client, {
        username: body.username,
        email: invite.email ?? body.email ?? null,
        passwordHash,
        displayName: body.displayName,
        role: invite.role,
        timeZone: body.timeZone,
        settings: { dailyGoal: body.dailyGoal },
      });
    } catch (err) {
      const e = err as { code?: string; constraint?: string };
      const field = e.code === '23505' && e.constraint ? TAKEN[e.constraint] : undefined;
      if (field) throw new AppError('conflict', `That ${field} is already taken`, { field });
      throw err;
    }
    await q.markInviteUsed(client, invite.id, user.id);
    const token = await issueSession(client, user.id, body.clientKind);
    return { user: toUser(user), token, clientKind: body.clientKind };
  });
}

/**
 * IF-06: the session a token belongs to, or null when it is unknown, expired, or its account is
 * disabled or holds an expired temporary password. Slides the expiry forward at most once per
 * SESSION_TOUCH_INTERVAL_SECONDS; `renewedUntil` is the new expiry when it moved.
 */
export async function authenticate(
  db: Queryable,
  token: string,
): Promise<{ context: AuthContext; renewedUntil: Date | null } | null> {
  const row = await q.findActiveSession(db, hashToken(token), SESSION_TOUCH_INTERVAL_SECONDS);
  if (!row || row.disabled_at || row.password_expired) return null;
  const renewedUntil = row.stale
    ? await q.touchSession(db, row.session_id, SESSION_TTL_DAYS)
    : null;
  const { session_id, client_kind, session_expires_at, stale, password_expired, ...user } = row;
  void session_expires_at;
  void stale;
  void password_expired;
  return {
    context: {
      userId: user.id as ScopedUserId,
      user,
      sessionId: session_id,
      clientKind: client_kind,
    },
    renewedUntil,
  };
}

/** FR-004: signs out the current session. */
export async function logout(db: Queryable, auth: AuthContext): Promise<void> {
  await q.deleteSession(db, auth.userId, auth.sessionId);
}

/** FR-004: the caller's own active sessions. */
export async function listSessions(db: Queryable, auth: AuthContext): Promise<Session[]> {
  const rows = await q.listSessions(db, auth.userId);
  return rows.map((row) => toSession(row, auth.sessionId));
}

/** FR-004, NFR-14: revokes one of the caller's sessions; another user's id is simply not found. */
export async function revokeSession(
  db: Queryable,
  auth: AuthContext,
  sessionId: number,
): Promise<void> {
  if (!(await q.deleteSession(db, auth.userId, sessionId))) {
    throw new AppError('not_found', 'Session not found');
  }
}

/**
 * FR-005, SDD section 11: replaces the password after checking the current one, clears any
 * temporary-password state and revokes every session of the account. The caller gets a new
 * session of the same client kind, so changing the password does not sign them out.
 */
export async function changePassword(
  pool: Pool,
  limiter: AttemptLimiter,
  ip: string,
  auth: AuthContext,
  body: ChangePasswordRequest,
): Promise<IssuedSession> {
  limit(limiter, [`password:ip:${ip}`, `password:user:${auth.userId}`]);
  const current = await q.findUserById(pool, auth.userId);
  if (!current) throw new AppError('unauthenticated', 'Not signed in');
  if (!(await verifyPassword(current.password_hash, body.currentPassword))) {
    throw new AppError('validation_failed', 'The current password is wrong', [
      { location: 'body', path: ['currentPassword'], message: 'The current password is wrong' },
    ]);
  }
  if (body.newPassword === body.currentPassword) {
    const message = 'Choose a password different from the current one';
    throw new AppError('validation_failed', message, [
      { location: 'body', path: ['newPassword'], message },
    ]);
  }
  checkNewPassword(body.newPassword, current.username, 'newPassword');
  const passwordHash = await hashPassword(body.newPassword);

  return withTransaction(pool, async (client) => {
    await q.setChosenPassword(client, auth.userId, passwordHash);
    await q.deleteSessionsOfUser(client, auth.userId);
    const token = await issueSession(client, auth.userId, auth.clientKind);
    const user = await q.findUserById(client, auth.userId);
    return { user: toUser(user!), token, clientKind: auth.clientKind };
  });
}

/** GET /me: the caller's account as of this request. */
export function me(auth: AuthContext): User {
  return toUser(auth.user);
}

// Admin operations used by the admin console (#23), which adds their routes. They live here
// because they write the same tables and token formats as sign-in.

/** FR-002: a new invite; the raw token goes into the link and is never stored. */
export async function createInvite(
  db: Queryable,
  options: { email: string | null; role: Role; createdBy: number | null; ttlDays?: number },
): Promise<{ token: string; invite: InviteRow }> {
  const token = newToken();
  const invite = await q.insertInvite(db, {
    tokenHash: hashToken(token),
    email: options.email,
    role: options.role,
    createdBy: options.createdBy,
    ttlDays: options.ttlDays ?? INVITE_TTL_DAYS,
  });
  return { token, invite };
}

/**
 * FR-005, FR-200: sets an admin-chosen temporary password that must be changed at the next
 * sign-in and expires after 7 days, and signs the account out everywhere. Returns whether the
 * user exists.
 */
export async function setTemporaryPassword(
  pool: Pool,
  userId: number,
  password: string,
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return withTransaction(pool, async (client) => {
    if (!(await q.setTemporaryPassword(client, userId, passwordHash, TEMP_PASSWORD_TTL_DAYS))) {
      return false;
    }
    await q.deleteSessionsOfUser(client, userId);
    return true;
  });
}

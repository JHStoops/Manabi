import { z } from 'zod';
import { emailSchema, timeZoneSchema, userSchema, usernameSchema } from './account';
import { idParamSchema, idSchema, nonEmptyTextSchema, timestampSchema } from './primitives';
import { dailyGoalSchema, learnerSettingsPatchSchema } from './settings';

/**
 * Request and response bodies of the auth routes (SDD sections 8 and 11, Product Spec section 11).
 * The server also rejects passwords on its common-password list, which is too large to ship here.
 */

/** SDD section 11: passwords have at least 10 characters. */
export const MIN_PASSWORD_LENGTH = 10;
/** Upper bound so a request cannot make the server hash megabytes. */
export const MAX_PASSWORD_LENGTH = 256;

/** A new password: the length rules of SDD section 11. */
export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(MAX_PASSWORD_LENGTH);

/** A password being checked (sign-in, current password): any length rules would leak policy. */
export const passwordAttemptSchema = z.string().min(1).max(MAX_PASSWORD_LENGTH);

/**
 * An opaque session, invite or reset token as sent to clients: 256 random bits in base64url
 * (43 characters). The database only ever holds its SHA-256 digest (NFR-10).
 */
export const opaqueTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Malformed token');

/**
 * IF-06: `web` sessions travel in an HttpOnly cookie and the token is never in a response body;
 * `mobile` (any non-browser client) gets the token in the body and sends it as a bearer header.
 */
export const clientKindSchema = z.enum(['web', 'mobile']);
export type ClientKind = z.infer<typeof clientKindSchema>;

/** FR-003: `POST /auth/login`. `identifier` is a username or an email address. */
export const loginRequestSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: passwordAttemptSchema,
  clientKind: clientKindSchema.default('web'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** FR-001: `POST /auth/accept-invite`, the invitee's choices (Product Spec section 11). */
export const acceptInviteRequestSchema = z.object({
  token: opaqueTokenSchema,
  username: usernameSchema,
  displayName: nonEmptyTextSchema.max(100),
  password: newPasswordSchema,
  /** Used only when the invite has no email address of its own. */
  email: emailSchema.optional(),
  dailyGoal: dailyGoalSchema,
  timeZone: timeZoneSchema.default('UTC'),
  clientKind: clientKindSchema.default('web'),
});
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;

/**
 * FR-005: `POST /auth/change-password`, the only route a session holding a temporary password may
 * use besides `GET /me` and sign-out.
 */
export const changePasswordRequestSchema = z.object({
  currentPassword: passwordAttemptSchema,
  newPassword: newPasswordSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

/**
 * FR-007: `PATCH /me`, the caller's display name and settings; only the fields sent change. Strict, so
 * nothing outside NFR-61 (or role, email, username) can be written here. The time zone follows
 * the device (#196), not this request. The password changes
 * through `POST /auth/change-password`, which also signs out other sessions.
 */
export const updateMeRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    settings: learnerSettingsPatchSchema.optional(),
  })
  .strict();
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;

/** A new session: the user, plus the token for `mobile` clients (web clients get the cookie). */
export const authResponseSchema = z.object({
  user: userSchema,
  token: opaqueTokenSchema.optional(),
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** FR-004: one of the caller's active sessions (`GET /me/sessions`). */
export const sessionSchema = z.object({
  id: idSchema,
  clientKind: clientKindSchema,
  createdAt: timestampSchema,
  lastSeenAt: timestampSchema,
  expiresAt: timestampSchema,
  /** The session making this request. */
  current: z.boolean(),
});
export type Session = z.infer<typeof sessionSchema>;

export const sessionListSchema = z.object({ sessions: z.array(sessionSchema) });
export type SessionList = z.infer<typeof sessionListSchema>;

/** `DELETE /me/sessions/:id`. */
export const sessionParamsSchema = z.object({ id: idParamSchema });

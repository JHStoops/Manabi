import { z } from 'zod';
import { emailSchema, roleSchema, userSchema } from './account';
import { newPasswordSchema, opaqueTokenSchema } from './auth';
import {
  idParamSchema,
  idSchema,
  jsonObjectSchema,
  localDateSchema,
  stableKeySchema,
  timestampSchema,
} from './primitives';

/**
 * Request and response bodies of the admin console routes (`/admin/users`, `/admin/invites`,
 * `/admin/imports`; Product Spec section 11) and the password-reset routes (FR-005).
 */

/** `/admin/users/:id`, `/admin/invites/:id`. */
export const adminIdParamsSchema = z.object({ id: idParamSchema });

/** FR-200: a user as the admin console lists them: last active day and current streak. */
export const adminUserSchema = userSchema.extend({
  lastActiveDate: localDateSchema.nullable(),
  currentStreak: z.number().int().nonnegative(),
  createdAt: timestampSchema,
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserListSchema = z.object({ users: z.array(adminUserSchema) });

/** FR-200: `PATCH /admin/users/:id` changes the role, disables or re-enables the account. */
export const updateUserRequestSchema = z
  .object({ role: roleSchema.optional(), disabled: z.boolean().optional() })
  .refine((b) => b.role !== undefined || b.disabled !== undefined, 'Nothing to change');
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

/** FR-005, FR-200: `POST /admin/users/:id/temporary-password`. */
export const temporaryPasswordRequestSchema = z.object({ password: newPasswordSchema });
export type TemporaryPasswordRequest = z.infer<typeof temporaryPasswordRequestSchema>;

export const inviteStatusSchema = z.enum(['pending', 'used', 'revoked', 'expired']);
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

/** FR-002: an invite as listed; the token itself is only ever in the link given at creation. */
export const inviteSchema = z.object({
  id: idSchema,
  email: emailSchema.nullable(),
  role: roleSchema,
  status: inviteStatusSchema,
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
});
export type Invite = z.infer<typeof inviteSchema>;

export const inviteListSchema = z.object({ invites: z.array(inviteSchema) });

/** Product Spec section 11: invites expire after 7 days unless the admin picks otherwise. */
export const createInviteRequestSchema = z.object({
  role: roleSchema.default('learner'),
  /** Where to email the link (IF-10: only when SMTP is configured); the link is returned anyway. */
  email: emailSchema.optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});
export type CreateInviteRequest = z.input<typeof createInviteRequestSchema>;

export const createInviteResponseSchema = z.object({
  invite: inviteSchema,
  /** The accept link to copy (IF-10). */
  link: z.string().url(),
  /** Whether the link was emailed. */
  emailed: z.boolean(),
});
export type CreateInviteResponse = z.infer<typeof createInviteResponseSchema>;

/** FR-226: the dataset importers an admin can run, named as in `import_runs.importer`. */
export const importerSchema = z.enum(['kanjidic2', 'jmdict', 'kanjivg', 'tatoeba', 'level-lists']);
export type Importer = z.infer<typeof importerSchema>;

/**
 * A dataset file or folder relative to the configured datasets directory. No absolute paths and
 * no `..` segments; the worker also checks the resolved path stays inside the directory.
 */
export const datasetFileSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (p) => !/^[\\/]|^[A-Za-z]:/.test(p) && !p.split(/[\\/]/).includes('..') && !p.includes('\0'),
    'Must be a path inside the datasets directory',
  );

/**
 * FR-226: `POST /admin/imports`. `file` defaults to where the download script puts the dataset;
 * the level-list import reads committed files and takes none.
 */
export const startImportRequestSchema = z.object({
  importer: importerSchema,
  courseKey: stableKeySchema,
  file: datasetFileSchema.optional(),
});
export type StartImportRequest = z.infer<typeof startImportRequestSchema>;

/** The data of an `import-*` job carrying a dataset file (validated again by the worker). */
export const importFileJobSchema = z.object({
  courseKey: stableKeySchema,
  file: datasetFileSchema,
});
export const importLevelListsJobSchema = z.object({ courseKey: stableKeySchema });

export const startImportResponseSchema = z.object({ jobId: z.string() });

export const importRunSchema = z.object({
  id: idSchema,
  importer: z.string(),
  status: z.enum(['running', 'succeeded', 'failed']),
  startedAt: timestampSchema,
  finishedAt: timestampSchema.nullable(),
  summary: jsonObjectSchema,
});
export type ImportRun = z.infer<typeof importRunSchema>;

export const importRunListSchema = z.object({ runs: z.array(importRunSchema) });

/** FR-005: `POST /auth/password-reset`, a username or email to send a reset link to. */
export const passwordResetRequestSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
});
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

/** FR-005: `POST /auth/password-reset/confirm`, the emailed token and the new password. */
export const passwordResetConfirmSchema = z.object({
  token: opaqueTokenSchema,
  newPassword: newPasswordSchema,
});
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;

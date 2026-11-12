import { z } from 'zod';
import { idSchema, nonEmptyTextSchema, timestampSchema } from './primitives';
import { learnerSettingsSchema } from './settings';

/** FR-006: the only two account types. There is no separate author role. */
export const roleSchema = z.enum(['admin', 'learner']);
export type Role = z.infer<typeof roleSchema>;

/** Sign-in is by username or email (FR-003), so a username has no '@' and no whitespace. */
export const usernameSchema = z.string().regex(/^[^\s@]{1,64}$/u);

export const emailSchema = z
  .string()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+$/u);

/** An IANA time zone name such as 'Asia/Tokyo', checked against the runtime's zone database. */
export const timeZoneSchema = z.string().refine((zone) => {
  if (zone === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}, 'Expected an IANA time zone name');

/** A user as the API returns it (`users` row without the password hash). */
export const userSchema = z.object({
  id: idSchema,
  username: usernameSchema,
  email: emailSchema.nullable(),
  displayName: nonEmptyTextSchema,
  role: roleSchema,
  mustChangePassword: z.boolean(),
  timeZone: timeZoneSchema,
  settings: learnerSettingsSchema,
  disabledAt: timestampSchema.nullable(),
});
export type User = z.infer<typeof userSchema>;

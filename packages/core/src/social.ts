import { z } from 'zod';
import { idParamSchema, idSchema, nonEmptyTextSchema, timestampSchema } from './primitives';

// Friends, profiles and nudges (FR-182 to FR-184, Product Spec section 9).

/** FR-183: the two one-tap nudges. */
export const nudgeKindSchema = z.enum(['nice_work', 'keep_going']);
export type NudgeKind = z.infer<typeof nudgeKindSchema>;

/**
 * FR-182: the only fields another learner may see (profiles and the friends list). Level and
 * section come from the learner's active course and are null before they enroll.
 */
export const publicProfileSchema = z.object({
  id: idSchema,
  displayName: nonEmptyTextSchema,
  currentStreak: z.number().int().nonnegative(),
  level: z.number().int().positive().nullable(),
  weeklyXp: z.number().int().nonnegative(),
  section: nonEmptyTextSchema.nullable(),
  /** Whether the caller follows this learner. */
  following: z.boolean(),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;

export const friendListSchema = z.object({ friends: z.array(publicProfileSchema) });
export type FriendList = z.infer<typeof friendListSchema>;

/** `/follows/:userId` and `/users/:userId/profile`. */
export const userIdParamsSchema = z.object({ userId: idParamSchema });

export const sendNudgeRequestSchema = z.object({ toUserId: idSchema, kind: nudgeKindSchema });

export const nudgeSchema = z.object({
  id: idSchema,
  fromUserId: idSchema,
  fromDisplayName: nonEmptyTextSchema,
  kind: nudgeKindSchema,
  sentAt: timestampSchema,
  seen: z.boolean(),
});
export type Nudge = z.infer<typeof nudgeSchema>;

export const nudgeListSchema = z.object({ nudges: z.array(nudgeSchema) });
export type NudgeList = z.infer<typeof nudgeListSchema>;

import { z } from 'zod';
import { idSchema } from './primitives';

/** FR-180: one opted-in learner's XP this week, across all courses. Ties share a rank. */
export const leaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  userId: idSchema,
  displayName: z.string(),
  xp: z.number().int().min(0),
});

/** FR-180: the weekly board (GET /leaderboard); `weekStart` is the Monday in the server's zone. */
export const leaderboardSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(leaderboardEntrySchema),
});
export type Leaderboard = z.infer<typeof leaderboardSchema>;

/** FR-181: a top-three finish in a closed week. */
export const weeklyBadgeSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rank: z.number().int().min(1).max(3),
  xp: z.number().int().min(0),
});
export const weeklyBadgesSchema = z.object({ badges: z.array(weeklyBadgeSchema) });
export type WeeklyBadges = z.infer<typeof weeklyBadgesSchema>;

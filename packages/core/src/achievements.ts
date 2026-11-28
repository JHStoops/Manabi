import { z } from 'zod';
import { stableKeySchema, timestampSchema } from './primitives';

/**
 * Achievements (FR-165; Product Spec section 9, SDD section 7). A definition is data: a metric
 * and a threshold, seeded by migration 0015. A metric is a family name, optionally followed by
 * `:` and an argument the family reads as data (an item type or a section's level code), so no
 * language-specific rule lives in code. The server computes the metric values inside progress
 * transactions; this module holds the shared schemas and the pure threshold check.
 */

/** Product Spec section 9: the achievement groups (stored as `achievements.group_key`). */
export const achievementGroupSchema = z.enum([
  'streak',
  'kanji',
  'vocabulary',
  'grammar',
  'course',
  'effort',
  'drawing',
]);
export type AchievementGroup = z.infer<typeof achievementGroupSchema>;

/**
 * The metric families the server knows how to compute:
 * - `streak_days`: the current streak in days.
 * - `familiar_items:<item type>`: items of that type with every review facet at stage 4
 *   (Familiar) or above.
 * - `learned_items:<item type>`: items of that type that have entered reviews.
 * - `section_complete:<level code>`: 1 once every published unit of a section with that level
 *   code is finished, else 0.
 * - `perfect_lessons`: lessons completed at least once with 100% accuracy.
 * - `reviews_in_day`: review answers on the learner's current local date.
 * - `xp_in_week`: XP earned this week (the leaderboard's week, FR-180).
 * - `characters_drawn`: distinct characters drawn from memory (EX-12) in completed lessons.
 */
export const METRIC_FAMILIES = [
  'streak_days',
  'familiar_items',
  'learned_items',
  'section_complete',
  'perfect_lessons',
  'reviews_in_day',
  'xp_in_week',
  'characters_drawn',
] as const;
export type MetricFamily = (typeof METRIC_FAMILIES)[number];

/** The family and argument of a metric name; null for a family the server does not know. */
export function parseMetric(metric: string): { family: MetricFamily; arg: string | null } | null {
  const at = metric.indexOf(':');
  const family = at === -1 ? metric : metric.slice(0, at);
  const arg = at === -1 ? null : metric.slice(at + 1);
  if (!(METRIC_FAMILIES as readonly string[]).includes(family)) return null;
  const needsArg = ['familiar_items', 'learned_items', 'section_complete'].includes(family);
  if (needsArg !== (arg !== null && arg !== '')) return null;
  return { family: family as MetricFamily, arg };
}

/** A definition as the engine reads it. */
export interface AchievementDefinition {
  key: string;
  metric: string;
  threshold: number;
}

/**
 * FR-165: the keys of definitions newly met: the metric's value has reached the threshold and the
 * learner has not earned the achievement yet. A metric with no computed value earns nothing.
 */
export function newlyEarned(
  definitions: readonly AchievementDefinition[],
  values: ReadonlyMap<string, number>,
  earned: ReadonlySet<string>,
): string[] {
  return definitions
    .filter((d) => !earned.has(d.key))
    .filter((d) => (values.get(d.metric) ?? -Infinity) >= d.threshold)
    .map((d) => d.key);
}

/** An achievement just unlocked by a progress request, for the client to celebrate. */
export const unlockedAchievementSchema = z.object({
  key: stableKeySchema,
  group: achievementGroupSchema,
  title: z.string().min(1),
  threshold: z.number().int().min(1),
});
export type UnlockedAchievement = z.infer<typeof unlockedAchievementSchema>;

/** Achievements unlocked by a progress request; empty when none. */
export const unlockedAchievementsSchema = z.array(unlockedAchievementSchema);

/** GET /me/achievements: every definition, with when the learner earned it and saw it. */
export const achievementSchema = unlockedAchievementSchema.extend({
  earnedAt: timestampSchema.nullable(),
  /** When the client showed the celebration (FR-165: shown once); null until then. */
  seenAt: timestampSchema.nullable(),
});
export type Achievement = z.infer<typeof achievementSchema>;

export const achievementListSchema = z.object({ achievements: z.array(achievementSchema) });
export type AchievementList = z.infer<typeof achievementListSchema>;

/** POST /me/achievements/seen: the celebrations the client has shown. */
export const achievementsSeenRequestSchema = z
  .object({ keys: z.array(stableKeySchema).min(1).max(100) })
  .strict();
export type AchievementsSeenRequest = z.infer<typeof achievementsSeenRequestSchema>;

/** Product Spec section 9: streak milestones get a full-screen celebration. */
export function isFullScreenCelebration(a: Pick<UnlockedAchievement, 'group'>): boolean {
  return a.group === 'streak';
}

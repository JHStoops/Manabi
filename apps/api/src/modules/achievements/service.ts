import type { Pool } from 'pg';
import { achievementGroupSchema, newlyEarned, parseMetric } from '@manabi/core';
import type { AchievementList, MetricFamily, UnlockedAchievement } from '@manabi/core';
import type { Queryable } from '../../db/db';
import type { ScopedUserId } from '../auth/service';
import { serverTimeZone } from '../social/service';
import * as q from './queries';

// FR-165, SDD section 7: the achievements engine. Definitions are data (a metric and a
// threshold). After a progress transaction writes its changes, it calls `evaluateAchievements`
// with the metric families it could have changed; only those metrics are recomputed, and newly
// met definitions are inserted in the same transaction, so an unlock commits or rolls back with
// the progress that earned it.

/** Metric families each progress transaction can change. */
export const LESSON_METRICS: readonly MetricFamily[] = [
  'streak_days',
  'xp_in_week',
  'perfect_lessons',
  'familiar_items',
  'learned_items',
  'section_complete',
  'characters_drawn',
];
export const TEST_OUT_METRICS: readonly MetricFamily[] = [
  'streak_days',
  'xp_in_week',
  'familiar_items',
  'learned_items',
  'section_complete',
  'characters_drawn',
];
export const REVIEW_METRICS: readonly MetricFamily[] = [
  'streak_days',
  'xp_in_week',
  'reviews_in_day',
  'familiar_items',
];

function computeMetric(db: Queryable, userId: number, metric: string): Promise<number> | null {
  const parsed = parseMetric(metric);
  if (!parsed) return null;
  const arg = parsed.arg ?? '';
  switch (parsed.family) {
    case 'streak_days':
      return q.streakDays(db, userId);
    case 'familiar_items':
      return q.familiarItems(db, userId, arg);
    case 'learned_items':
      return q.learnedItems(db, userId, arg);
    case 'section_complete':
      return q.sectionComplete(db, userId, arg);
    case 'perfect_lessons':
      return q.perfectLessons(db, userId);
    case 'reviews_in_day':
      return q.reviewsInDay(db, userId);
    case 'xp_in_week':
      return q.xpInWeek(db, userId, serverTimeZone());
    case 'characters_drawn':
      return q.charactersDrawn(db, userId);
  }
}

const toUnlocked = (row: q.DefinitionRow): UnlockedAchievement => ({
  key: row.key,
  group: achievementGroupSchema.parse(row.group_key),
  title: row.title,
  threshold: row.threshold,
});

/**
 * FR-165: inside the caller's progress transaction, recomputes the metrics of the given families
 * that some unearned definition uses and records each definition now met. Idempotent: an unlock
 * is inserted once (the primary key), and only rows this call inserted are returned.
 */
export async function evaluateAchievements(
  db: Queryable,
  userId: number,
  families: readonly MetricFamily[],
): Promise<UnlockedAchievement[]> {
  if (families.length === 0) return [];
  await q.lockLearnerAchievements(db, userId);
  const definitions = await q.listUnearnedDefinitions(db, userId, families);
  if (definitions.length === 0) return [];
  const values = new Map<string, number>();
  for (const metric of new Set(definitions.map((d) => d.metric))) {
    const value = computeMetric(db, userId, metric);
    // A metric the engine does not know (a definition added ahead of its code) earns nothing.
    if (value) values.set(metric, await value);
  }
  const met = new Set(newlyEarned(definitions, values, new Set()));
  const unlocked: UnlockedAchievement[] = [];
  for (const row of definitions) {
    if (met.has(row.key) && (await q.insertUserAchievement(db, userId, row.key))) {
      unlocked.push(toUnlocked(row));
    }
  }
  return unlocked;
}

/** FR-165: inside the lesson-completion transaction, records the characters drawn from memory. */
export function recordDrawnCharacters(db: Queryable, userId: number, itemKeys: readonly string[]) {
  return q.insertDrawnCharacters(db, userId, [...new Set(itemKeys)]);
}

/** GET /me/achievements: every definition, earned or not. */
export async function listAchievements(db: Pool, userId: ScopedUserId): Promise<AchievementList> {
  const rows = await q.listForUser(db, userId);
  return {
    achievements: rows.map((row) => ({
      ...toUnlocked(row),
      earnedAt: row.earned_at?.toISOString() ?? null,
      seenAt: row.seen_at?.toISOString() ?? null,
    })),
  };
}

/** FR-165: the client has shown these celebrations; they are not shown again. */
export async function markSeen(
  db: Pool,
  userId: ScopedUserId,
  keys: readonly string[],
): Promise<AchievementList> {
  await q.markSeen(db, userId, keys);
  return listAchievements(db, userId);
}

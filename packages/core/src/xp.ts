/**
 * XP rules (FR-160, FR-162, FR-055; Product Spec section 9, SDD section 7). Pure functions; the
 * API applies them inside the progress transaction and records each award in xp_events.
 */

/** Base XP per award reason. The keys are the `reason` codes stored in xp_events. */
export const XP_RULES = {
  lesson_new: 10,
  /** 90% or better before the retry round, on a lesson's first completion. */
  lesson_accuracy_bonus: 5,
  lesson_replay: 5,
  /** Per review item answered correctly. */
  review_correct: 1,
  unit_review: 20,
  test_out: 30,
  drill: 5,
} as const;
export type XpReason = keyof typeof XP_RULES;

/** Accuracy (whole percent, before the retry round) that earns the lesson accuracy bonus. */
export const ACCURACY_BONUS_THRESHOLD = 90;

/** The awards for completing a lesson: new (with the bonus when earned) or a replay (FR-055). */
export function lessonXpReasons(firstCompletion: boolean, accuracy: number): XpReason[] {
  if (!firstCompletion) return ['lesson_replay'];
  return accuracy >= ACCURACY_BONUS_THRESHOLD
    ? ['lesson_new', 'lesson_accuracy_bonus']
    : ['lesson_new'];
}

/**
 * FR-162: total XP needed to reach `level`. Each level needs 100 XP more than the last, so level
 * 2 is at 100, 3 at 300, 4 at 600: 50 * level * (level - 1).
 */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

/** FR-162: the level reached with `totalXp` XP in a course (1 at 0 XP). */
export function levelForXp(totalXp: number): number {
  // Inverse of xpForLevel, then nudged to absorb floating-point error at exact thresholds.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + totalXp / 12.5)) / 2));
  while (xpForLevel(level + 1) <= totalXp) level++;
  while (level > 1 && xpForLevel(level) > totalXp) level--;
  return level;
}

/** Progress within the current level, for the results screen. */
export interface LevelProgress {
  level: number;
  /** XP earned since the current level started. */
  xpIntoLevel: number;
  /** XP the current level spans (100 * level). */
  xpForNextLevel: number;
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = levelForXp(totalXp);
  return {
    level,
    xpIntoLevel: totalXp - xpForLevel(level),
    xpForNextLevel: xpForLevel(level + 1) - xpForLevel(level),
  };
}

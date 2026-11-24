import { z } from 'zod';
import { dailyGoalSchema } from './settings';

/**
 * Streak rules (FR-163, FR-164; Product Spec section 9, SDD section 7). Pure functions over local
 * calendar dates ('YYYY-MM-DD', the learner's own date from xp_events.local_date), so time zones
 * and daylight saving never enter the arithmetic: a date is a plain UTC calendar day here.
 */

/** FR-163: XP a learner must earn on a local day for it to count toward the streak. */
export const STREAK_DAY_XP = 10;
/** FR-164: the most freezes a learner can hold. */
export const MAX_FREEZES = 2;
/** FR-164: one freeze is granted for each run of this many streak days. */
export const FREEZE_RUN_DAYS = 7;

/** The streak cache (user_stats). `lastActiveDate` is the last day earned or covered by a freeze. */
export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  freezes: number;
  lastActiveDate: string | null;
}

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
}

function dayBefore(date: string): string {
  return new Date((dayNumber(date) - 1) * 86_400_000).toISOString().slice(0, 10);
}

/**
 * FR-164: handles the days after `lastActiveDate` up to and including `through` (the learner's
 * yesterday), which were missed. If held freezes cover them all, they are spent and those days
 * count as covered; otherwise the streak resets to 0 and the freezes are kept.
 */
export function settleMissedDays(state: StreakState, through: string): StreakState {
  if (state.currentStreak === 0 || state.lastActiveDate === null) return state;
  const missed = dayNumber(through) - dayNumber(state.lastActiveDate);
  if (missed <= 0) return state;
  if (missed <= state.freezes) {
    return { ...state, freezes: state.freezes - missed, lastActiveDate: through };
  }
  return { ...state, currentStreak: 0 };
}

/**
 * FR-163, FR-164: the state after the learner first reaches STREAK_DAY_XP on local date `today`.
 * Does nothing if the day is already counted (or is older than the last counted day).
 */
export function advanceStreak(state: StreakState, today: string): StreakState {
  if (state.lastActiveDate !== null && state.lastActiveDate >= today) return state;
  const settled = settleMissedDays(state, dayBefore(today));
  const currentStreak = settled.currentStreak + 1;
  return {
    currentStreak,
    longestStreak: Math.max(settled.longestStreak, currentStreak),
    freezes:
      currentStreak % FREEZE_RUN_DAYS === 0
        ? Math.min(MAX_FREEZES, settled.freezes + 1)
        : settled.freezes,
    lastActiveDate: today,
  };
}

/** FR-161, FR-163, FR-164: the Learn tab's daily goal ring and streak flame (GET /me/stats). */
export const userStatsSchema = z.object({
  dailyGoal: dailyGoalSchema,
  /** XP earned today in the learner's time zone, across all courses. */
  todayXp: z.number().int().min(0),
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  freezes: z.number().int().min(0).max(MAX_FREEZES),
});
export type UserStats = z.infer<typeof userStatsSchema>;

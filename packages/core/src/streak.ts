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

/** Days missed between the last counted day and `today` (the learner's local date). */
function missedDays(state: StreakState, today: string): number {
  if (state.currentStreak === 0 || state.lastActiveDate === null) return 0;
  return Math.max(0, dayNumber(today) - dayNumber(state.lastActiveDate) - 1);
}

/**
 * FR-164: the freezes the learner may choose to spend to keep the streak: set when the missed days
 * are at least 1 and no more than the freezes held. Null otherwise.
 */
export function pendingFreezeSpend(state: StreakState, today: string): { days: number } | null {
  const days = missedDays(state, today);
  return days >= 1 && days <= state.freezes ? { days } : null;
}

/**
 * FR-164: the streak for a learner whose local `today` has begun. Freezes are never spent here:
 * the streak resets to 0 once the missed days exceed the freezes held (freezes are kept), and
 * otherwise waits for the learner's choice. Safe to repeat; the result does not depend on how
 * often it ran.
 */
export function settleMissedDays(state: StreakState, today: string): StreakState {
  return missedDays(state, today) > state.freezes ? { ...state, currentStreak: 0 } : state;
}

/** FR-164: the learner said yes: spends the pending freezes and counts the missed days as covered. */
export function spendFreezes(state: StreakState, today: string): StreakState {
  const pending = pendingFreezeSpend(state, today);
  if (!pending) return state;
  return {
    ...state,
    freezes: state.freezes - pending.days,
    lastActiveDate: dayBefore(today),
  };
}

/** FR-164: the learner said no: the streak resets and the freezes are kept. */
export function declineFreezes(state: StreakState): StreakState {
  return { ...state, currentStreak: 0 };
}

/**
 * FR-163, FR-164: the state after the learner first reaches STREAK_DAY_XP on local date `today`.
 * Does nothing if the day is already counted (or is older than the last counted day).
 */
export function advanceStreak(state: StreakState, today: string): StreakState {
  if (state.lastActiveDate !== null && state.lastActiveDate >= today) return state;
  // Earning XP while a freeze offer is still open counts as declining it: the streak resets,
  // freezes are kept, and it restarts at 1 for today (owner decision).
  const base = missedDays(state, today) > 0 ? declineFreezes(state) : state;
  const currentStreak = base.currentStreak + 1;
  return {
    currentStreak,
    longestStreak: Math.max(base.longestStreak, currentStreak),
    freezes:
      currentStreak % FREEZE_RUN_DAYS === 0
        ? Math.min(MAX_FREEZES, base.freezes + 1)
        : base.freezes,
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
  /** Set when the learner may spend `days` freezes to keep the streak (FR-164). */
  pendingFreezeSpend: z.object({ days: z.number().int().min(1).max(MAX_FREEZES) }).nullable(),
});
export type UserStats = z.infer<typeof userStatsSchema>;

/** FR-164: the learner's answer to the freeze offer: spend the freezes, or let the streak reset. */
export const streakFreezeChoiceSchema = z.object({ spend: z.boolean() });
export type StreakFreezeChoice = z.infer<typeof streakFreezeChoiceSchema>;

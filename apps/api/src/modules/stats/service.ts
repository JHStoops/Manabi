import type { Pool } from 'pg';
import {
  STREAK_DAY_XP,
  advanceStreak,
  learnerSettingsSchema,
  settleMissedDays,
} from '@manabi/core';
import type { StreakState, UserStats } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import type { ScopedUserId } from '../auth/service';
import * as q from './queries';

// Streak and daily goal (FR-161, FR-163, FR-164; SDD section 7).

const toState = (r: q.StatsRow): StreakState => ({
  currentStreak: r.current_streak,
  longestStreak: r.longest_streak,
  freezes: r.freezes,
  lastActiveDate: r.last_active_date,
});

const toRow = (s: StreakState): q.StatsRow => ({
  current_streak: s.currentStreak,
  longest_streak: s.longestStreak,
  freezes: s.freezes,
  last_active_date: s.lastActiveDate,
});

/**
 * FR-163, FR-164: after an XP award on `localDate`, advances the streak once the learner's XP for
 * that date, across courses, reaches 10. Runs in the award's transaction. The user_stats row lock
 * serializes a learner's awards, so two courses' awards cannot both miss the threshold.
 */
export async function recordXpForStreak(db: Queryable, userId: number, localDate: string) {
  const stats = await q.lockStats(db, userId);
  if (stats.last_active_date !== null && stats.last_active_date >= localDate) return;
  if ((await q.sumXpOnDate(db, userId, localDate)) < STREAK_DAY_XP) return;
  await q.saveStats(db, userId, toRow(advanceStreak(toState(stats), localDate)));
}

/**
 * FR-164: the nightly job. For each learner with a running streak who missed a day (in their own
 * time zone), spends freezes or resets the streak, so the number is right without opening the app.
 * One transaction per learner; running it again changes nothing. Returns how many were checked.
 */
export async function settleStreaks(db: Pool): Promise<number> {
  const due = await q.listStreaksToSettle(db);
  for (const { user_id, yesterday } of due) {
    await withTransaction(db, async (client) => {
      const stats = await q.lockStats(client, user_id);
      await q.saveStats(client, user_id, toRow(settleMissedDays(toState(stats), yesterday)));
    });
  }
  return due.length;
}

/** FR-161, FR-163, FR-164: the Learn tab's daily goal and streak. */
export async function getStats(db: Queryable, userId: ScopedUserId): Promise<UserStats> {
  const row = await q.findUserStats(db, userId);
  if (!row) throw new AppError('not_found', 'User not found');
  return {
    dailyGoal: learnerSettingsSchema.parse(row.settings).dailyGoal,
    todayXp: row.today_xp,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    freezes: row.freezes,
  };
}

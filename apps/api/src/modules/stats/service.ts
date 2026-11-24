import type { Pool } from 'pg';
import {
  STREAK_DAY_XP,
  advanceStreak,
  declineFreezes,
  pendingFreezeSpend,
  learnerSettingsSchema,
  settleMissedDays,
  spendFreezes,
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
 * FR-164: the hourly job. Resets the streak of learners who missed more days (in their own time
 * zone) than they hold freezes; it never spends freezes. One transaction per learner; running it
 * again, or after skipped runs, gives the same result. Returns how many were checked.
 */
export async function settleStreaks(db: Pool): Promise<number> {
  const due = await q.listStreaksToSettle(db);
  for (const { user_id, today } of due) {
    await withTransaction(db, async (client) => {
      const stats = await q.lockStats(client, user_id);
      await q.saveStats(client, user_id, toRow(settleMissedDays(toState(stats), today)));
    });
  }
  return due.length;
}

/**
 * FR-164: the learner's answer to the freeze offer. Re-checks the gap under the user_stats lock;
 * with no offer open (answered already, streak reset, or the day was counted) it is a 409.
 */
export async function chooseFreezes(
  db: Pool,
  userId: ScopedUserId,
  spend: boolean,
): Promise<UserStats> {
  await withTransaction(db, async (client) => {
    const stats = toState(await q.lockStats(client, userId));
    const today = await q.findLocalToday(client, userId);
    if (!pendingFreezeSpend(stats, today)) {
      throw new AppError('conflict', 'There are no streak freezes to spend');
    }
    await q.saveStats(
      client,
      userId,
      toRow(spend ? spendFreezes(stats, today) : declineFreezes(stats)),
    );
  });
  return getStats(db, userId);
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
    pendingFreezeSpend: pendingFreezeSpend(toState(row), row.today),
  };
}

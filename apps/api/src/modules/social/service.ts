import { learnerSettingsSchema } from '@manabi/core';
import type {
  FriendList,
  Leaderboard,
  NudgeList,
  NudgeKind,
  PublicProfile,
  WeeklyBadges,
} from '@manabi/core';
import type { Pool } from 'pg';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import type { AuthContext, ScopedUserId } from '../auth/service';
import * as q from './queries';

// Follows, friends and nudges (FR-182 to FR-184). Only the public profile fields ever leave here.

function toProfile(row: q.ProfileRow): PublicProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    currentStreak: row.current_streak,
    level: row.level,
    weeklyXp: row.weekly_xp,
    section: row.section,
    following: row.following,
  };
}

export async function getProfile(
  db: Queryable,
  viewerId: ScopedUserId,
  userId: number,
): Promise<PublicProfile> {
  const row = await q.findProfile(db, viewerId, userId);
  if (!row) throw new AppError('not_found', 'Learner not found');
  return toProfile(row);
}

export async function follow(db: Queryable, userId: ScopedUserId, targetId: number) {
  if (targetId === userId) throw new AppError('bad_request', 'You cannot follow yourself');
  if (!(await q.findProfile(db, userId, targetId))) {
    throw new AppError('not_found', 'Learner not found');
  }
  await q.insertFollow(db, userId, targetId);
}

export const unfollow = q.deleteFollow;

export async function listFriends(db: Queryable, userId: ScopedUserId): Promise<FriendList> {
  return { friends: (await q.listFriends(db, userId)).map(toProfile) };
}

/** FR-183, FR-184: one nudge per friend per day, to friends who allow nudges. */
export async function sendNudge(
  db: Queryable,
  auth: AuthContext,
  toUserId: number,
  kind: NudgeKind,
) {
  const recipient = await q.findNudgeRecipient(db, toUserId);
  if (!recipient || toUserId === auth.userId) throw new AppError('not_found', 'Learner not found');
  if (!(await q.isFollowing(db, auth.userId, toUserId))) {
    throw new AppError('forbidden', 'You can only nudge friends you follow');
  }
  if (!learnerSettingsSchema.parse(recipient.settings).allowNudges) {
    throw new AppError('forbidden', 'This learner does not accept nudges');
  }
  if (!(await q.insertNudge(db, auth.userId, toUserId, kind, auth.user.time_zone))) {
    throw new AppError('conflict', 'You already nudged this friend today');
  }
}

export async function listNudges(db: Queryable, userId: ScopedUserId): Promise<NudgeList> {
  const rows = await q.listNudges(db, userId);
  return {
    nudges: rows.map((r) => ({
      id: r.id,
      fromUserId: r.from_user_id,
      fromDisplayName: r.from_display_name,
      kind: r.kind,
      sentAt: r.sent_at.toISOString(),
      seen: r.seen_at !== null,
    })),
  };
}

export const markNudgesSeen = q.markNudgesSeen;

/** FR-181: weeks run in the server's time zone (the deployment's TZ, also used for cron). */
export const serverTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const CACHE_MS = 30_000;
// shortcut: per-process cache, so each API instance may differ for up to 30 s; fine for one server.
let cache: { at: number; weekStart: string; board: Leaderboard } | null = null;

/** Tests only: forgets the cached board. */
export const clearLeaderboardCache = () => {
  cache = null;
};

/**
 * FR-180: XP earned this week across all courses by opted-in learners, cached for 30 seconds.
 * Everyone sees the same board, so opted-out learners can look but are not listed.
 */
export async function getLeaderboard(
  db: Queryable,
  now: Date = new Date(),
  timeZone = serverTimeZone(),
): Promise<Leaderboard> {
  if (cache && now.getTime() - cache.at < CACHE_MS && now.getTime() >= cache.at) {
    return cache.board;
  }
  const weekStart = await q.weekStartOf(db, now, timeZone);
  const rows = await q.weekBoard(db, weekStart, timeZone);
  const board = {
    weekStart,
    entries: rows.map((r) => ({
      rank: r.rank,
      userId: r.user_id,
      displayName: r.display_name,
      xp: r.xp,
    })),
  };
  cache = { at: now.getTime(), weekStart, board };
  return board;
}

/**
 * FR-181: stores the final ranks of the week before the one containing `now`. Run at Monday 00:00,
 * the end of Sunday 23:59; a late or repeated run writes the same week once. Returns rows written.
 */
export async function closeLastWeek(
  db: Pool,
  now: Date = new Date(),
  timeZone = serverTimeZone(),
): Promise<number> {
  return withTransaction(db, async (client) =>
    q.insertWeeklyResults(client, await q.weekStartOf(client, now, timeZone, -7), timeZone),
  );
}

/** FR-181: the caller's top-three finishes. */
export async function getBadges(db: Queryable, userId: number): Promise<WeeklyBadges> {
  const rows = await q.listBadges(db, userId);
  return {
    badges: rows.map((r) => ({ weekStart: r.week_start, rank: r.rank, xp: r.xp })),
  };
}

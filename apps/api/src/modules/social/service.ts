import { learnerSettingsSchema } from '@manabi/core';
import type { FriendList, NudgeList, NudgeKind, PublicProfile } from '@manabi/core';
import type { Queryable } from '../../db/db';
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

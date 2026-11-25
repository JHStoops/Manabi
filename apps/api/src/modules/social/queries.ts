import type { NudgeKind } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { query, queryOne } from '../../db/db';

// Hand-written, parameterized SQL for follows, public profiles and nudges (FR-182, FR-183).

/** Public fields of a learner (FR-182). $1 is the caller, for `following`. */
export interface ProfileRow {
  id: number;
  display_name: string;
  current_streak: number;
  level: number | null;
  weekly_xp: number;
  section: string | null;
  following: boolean;
}

// The level and section are those of the learner's active course; the section is the first one
// with a published unit they have not completed. The week starts Monday in the database's zone.
// shortcut: a learner who finished every unit shows no section, revisit when courses can end.
const PROFILE_SELECT = `
  SELECT u.id, u.display_name, COALESCE(s.current_streak, 0) AS current_streak, e.level,
         COALESCE((SELECT sum(x.amount) FROM xp_events x
                    WHERE x.user_id = u.id AND x.earned_at >= date_trunc('week', now())), 0)::int
           AS weekly_xp,
         (SELECT sec.title FROM sections sec JOIN units un ON un.section_id = sec.id
           WHERE sec.course_id = (u.settings->>'activeCourseId')::bigint
             AND un.status = 'published'
             AND NOT EXISTS (SELECT 1 FROM unit_completions uc
                              WHERE uc.user_id = u.id AND uc.unit_id = un.id)
           ORDER BY sec.position, un.position LIMIT 1) AS section,
         EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = u.id)
           AS following
    FROM users u
    LEFT JOIN user_stats s ON s.user_id = u.id
    LEFT JOIN enrollments e
      ON e.user_id = u.id AND e.course_id = (u.settings->>'activeCourseId')::bigint`;

export function findProfile(db: Queryable, viewerId: number, userId: number) {
  return queryOne<ProfileRow>(db, `${PROFILE_SELECT} WHERE u.id = $2 AND u.disabled_at IS NULL`, [
    viewerId,
    userId,
  ]);
}

export function listFriends(db: Queryable, userId: number) {
  return query<ProfileRow>(
    db,
    `${PROFILE_SELECT}
      WHERE u.disabled_at IS NULL
        AND EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = u.id)
      ORDER BY u.display_name, u.id`,
    [userId],
  );
}

/** FR-182: following twice keeps the first follow. */
export async function insertFollow(db: Queryable, followerId: number, followeeId: number) {
  await query(
    db,
    `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [followerId, followeeId],
  );
}

export async function deleteFollow(db: Queryable, followerId: number, followeeId: number) {
  await query(db, `DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [
    followerId,
    followeeId,
  ]);
}

/** The recipient's settings, for the nudge opt-out (FR-184); null when missing or disabled. */
export function findNudgeRecipient(db: Queryable, userId: number) {
  return queryOne<{ settings: unknown }>(
    db,
    `SELECT settings FROM users WHERE id = $1 AND disabled_at IS NULL`,
    [userId],
  );
}

export async function isFollowing(db: Queryable, followerId: number, followeeId: number) {
  const row = await queryOne(
    db,
    `SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2`,
    [followerId, followeeId],
  );
  return row !== null;
}

/** FR-183: false when the sender already nudged this friend on their local date in `timeZone`. */
export async function insertNudge(
  db: Queryable,
  fromId: number,
  toId: number,
  kind: NudgeKind,
  timeZone: string,
) {
  const rows = await query(
    db,
    `INSERT INTO nudges (from_user_id, to_user_id, kind, local_date)
     VALUES ($1, $2, $3, (now() AT TIME ZONE $4)::date)
     ON CONFLICT ON CONSTRAINT nudges_one_per_day_key DO NOTHING
     RETURNING id`,
    [fromId, toId, kind, timeZone],
  );
  return rows.length > 0;
}

export interface NudgeListRow {
  id: number;
  from_user_id: number;
  from_display_name: string;
  kind: NudgeKind;
  sent_at: Date;
  seen_at: Date | null;
}

/** The learner's 30 newest nudges. */
export function listNudges(db: Queryable, userId: number) {
  return query<NudgeListRow>(
    db,
    `SELECT n.id, n.from_user_id, u.display_name AS from_display_name, n.kind, n.sent_at, n.seen_at
       FROM nudges n JOIN users u ON u.id = n.from_user_id
      WHERE n.to_user_id = $1
      ORDER BY n.sent_at DESC, n.id DESC LIMIT 30`,
    [userId],
  );
}

export async function markNudgesSeen(db: Queryable, userId: number) {
  await query(db, `UPDATE nudges SET seen_at = now() WHERE to_user_id = $1 AND seen_at IS NULL`, [
    userId,
  ]);
}

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

// Weekly leaderboard (FR-180, FR-181).

export interface BoardRow {
  rank: number;
  user_id: number;
  display_name: string;
  xp: number;
}

/** FR-180: the Monday (date, in `timeZone`) of the week containing `at`, plus `days`. */
export async function weekStartOf(
  db: Queryable,
  at: Date,
  timeZone: string,
  days = 0,
): Promise<string> {
  const [row] = await query<{ week_start: string }>(
    db,
    `SELECT (date_trunc('week', $1::timestamptz AT TIME ZONE $2)::date + $3::int)::text AS week_start`,
    [at, timeZone, days],
  );
  return row!.week_start;
}

// Opted-in, enabled learners ranked by XP over the week that starts on $1 (a Monday) in zone $2.
// Ties share a rank. Opting in is the default, so a missing setting counts as in.
const WEEK_BOARD = `
  SELECT rank() OVER (ORDER BY sum(x.amount) DESC)::int AS rank,
         u.id AS user_id, u.display_name, sum(x.amount)::int AS xp
    FROM xp_events x
    JOIN users u ON u.id = x.user_id
   WHERE x.earned_at >= ($1::date::timestamp AT TIME ZONE $2)
     AND x.earned_at <  (($1::date + 7)::timestamp AT TIME ZONE $2)
     AND u.disabled_at IS NULL
     AND COALESCE((u.settings->>'appearOnLeaderboard')::boolean, true)
   GROUP BY u.id
  HAVING sum(x.amount) > 0`;

export function weekBoard(db: Queryable, weekStart: string, timeZone: string) {
  return query<BoardRow>(
    db,
    `SELECT * FROM (${WEEK_BOARD}) b ORDER BY rank, display_name, user_id`,
    [weekStart, timeZone],
  );
}

/**
 * FR-181: stores the final ranks of a week, once. A week that already has results is left alone,
 * so a retried or repeated job changes nothing. Returns how many rows were written.
 */
export async function insertWeeklyResults(db: Queryable, weekStart: string, timeZone: string) {
  const rows = await query(
    db,
    `INSERT INTO weekly_results (week_start, user_id, xp, rank)
     SELECT $1::date, user_id, xp, rank FROM (${WEEK_BOARD}) b
      WHERE NOT EXISTS (SELECT 1 FROM weekly_results WHERE week_start = $1::date)
     RETURNING user_id`,
    [weekStart, timeZone],
  );
  return rows.length;
}

/** FR-181: a learner's top-three finishes, newest first. */
export function listBadges(db: Queryable, userId: number) {
  return query<{ week_start: string; rank: number; xp: number }>(
    db,
    `SELECT week_start::text, rank, xp FROM weekly_results
      WHERE user_id = $1 AND rank <= 3 ORDER BY week_start DESC`,
    [userId],
  );
}

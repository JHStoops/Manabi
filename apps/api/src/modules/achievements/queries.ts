import type { Queryable } from '../../db/db';
import { query, queryOne } from '../../db/db';

// Hand-written, parameterized SQL for achievements (FR-165, SDD section 7): the seeded
// definitions, the learner's unlocks, and one query per metric family. Every metric reads tables
// the progress transaction has already written, so it sees that transaction's own changes.

export interface DefinitionRow {
  key: string;
  group_key: string;
  metric: string;
  threshold: number;
  title: string;
}

/** Definitions the learner has not earned yet whose metric is in one of the families given. */
export function listUnearnedDefinitions(
  db: Queryable,
  userId: number,
  families: readonly string[],
): Promise<DefinitionRow[]> {
  return query(
    db,
    `SELECT a.key, a.group_key, a.metric, a.threshold, a.title
       FROM achievements a
      WHERE split_part(a.metric, ':', 1) = ANY ($2::text[])
        AND NOT EXISTS (SELECT 1 FROM user_achievements ua
                         WHERE ua.user_id = $1 AND ua.achievement_key = a.key)
      ORDER BY a.group_key, a.threshold, a.key`,
    [userId, families],
  );
}

/**
 * FR-165: records an unlock once. Returns false when the learner already had it (a concurrent
 * transaction, or a repeat), so the caller celebrates only what this transaction inserted.
 */
export async function insertUserAchievement(
  db: Queryable,
  userId: number,
  key: string,
): Promise<boolean> {
  const rows = await query(
    db,
    `INSERT INTO user_achievements (user_id, achievement_key) VALUES ($1, $2)
     ON CONFLICT DO NOTHING RETURNING achievement_key`,
    [userId, key],
  );
  return rows.length === 1;
}

export interface UserAchievementListRow extends DefinitionRow {
  earned_at: Date | null;
  seen_at: Date | null;
}

/** GET /me/achievements: every definition, with the learner's unlock when there is one. */
export function listForUser(db: Queryable, userId: number): Promise<UserAchievementListRow[]> {
  return query(
    db,
    `SELECT a.key, a.group_key, a.metric, a.threshold, a.title, ua.earned_at, ua.seen_at
       FROM achievements a
       LEFT JOIN user_achievements ua ON ua.achievement_key = a.key AND ua.user_id = $1
      ORDER BY a.group_key, a.threshold, a.key`,
    [userId],
  );
}

/** FR-165: marks celebrations as shown; keys already seen or not earned are left alone. */
export async function markSeen(db: Queryable, userId: number, keys: readonly string[]) {
  await query(
    db,
    `UPDATE user_achievements SET seen_at = now()
      WHERE user_id = $1 AND achievement_key = ANY ($2::text[]) AND seen_at IS NULL`,
    [userId, keys],
  );
}

/**
 * FR-165: serializes a learner's achievement evaluations. A transaction sees only its own
 * uncommitted writes, so two concurrent progress transactions could each count one short of a
 * threshold (99 reviews today) and both miss it; waiting here makes the second one's metric
 * queries see the first one's committed rows.
 */
export async function lockLearnerAchievements(db: Queryable, userId: number) {
  await query(db, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    `achievements:${userId}`,
  ]);
}

/** FR-165: records the characters drawn from memory in a completed lesson (once each). */
export async function insertDrawnCharacters(
  db: Queryable,
  userId: number,
  itemKeys: readonly string[],
) {
  if (itemKeys.length === 0) return;
  await query(
    db,
    `INSERT INTO drawn_characters (user_id, item_id)
     SELECT $1, i.id FROM items i WHERE i.key = ANY ($2::text[])
     ON CONFLICT DO NOTHING`,
    [userId, itemKeys],
  );
}

// Metric values, one query per family.

const valueOf = async (db: Queryable, sql: string, params: unknown[]): Promise<number> =>
  (await queryOne<{ n: number }>(db, sql, params))!.n;

/** streak_days: the current streak (user_stats is kept in the same transaction). */
export function streakDays(db: Queryable, userId: number): Promise<number> {
  return valueOf(
    db,
    `SELECT COALESCE((SELECT current_streak FROM user_stats WHERE user_id = $1), 0)::int AS n`,
    [userId],
  );
}

/**
 * familiar_items:<type>: unarchived items of the type with every facet at stage 4 (Familiar) or
 * above, across the learner's courses.
 */
export function familiarItems(db: Queryable, userId: number, itemType: string): Promise<number> {
  return valueOf(
    db,
    `SELECT count(*)::int AS n FROM (
       SELECT p.item_id FROM item_progress p
         JOIN items i ON i.id = p.item_id
        WHERE p.user_id = $1 AND i.type = $2 AND i.archived_at IS NULL
        GROUP BY p.item_id
       HAVING min(p.stage) >= 4) familiar`,
    [userId, itemType],
  );
}

/** learned_items:<type>: unarchived items of the type that have entered reviews. */
export function learnedItems(db: Queryable, userId: number, itemType: string): Promise<number> {
  return valueOf(
    db,
    `SELECT count(DISTINCT p.item_id)::int AS n FROM item_progress p
       JOIN items i ON i.id = p.item_id
      WHERE p.user_id = $1 AND i.type = $2 AND i.archived_at IS NULL`,
    [userId, itemType],
  );
}

/**
 * section_complete:<level>: 1 when the learner has finished every published, unarchived unit of
 * a section (with at least one such unit) at that level code, in a published course they are
 * enrolled in.
 */
export function sectionComplete(db: Queryable, userId: number, levelCode: string): Promise<number> {
  return valueOf(
    db,
    `SELECT (EXISTS (
       SELECT 1 FROM sections s
         JOIN enrollments e ON e.course_id = s.course_id AND e.user_id = $1
         JOIN courses co ON co.id = s.course_id AND co.status = 'published'
        WHERE s.level_code = $2 AND s.archived_at IS NULL
          AND EXISTS (SELECT 1 FROM units u
                       WHERE u.section_id = s.id AND u.archived_at IS NULL
                         AND u.status = 'published')
          AND NOT EXISTS (
            SELECT 1 FROM units u
             WHERE u.section_id = s.id AND u.archived_at IS NULL AND u.status = 'published'
               AND NOT EXISTS (SELECT 1 FROM unit_completions c
                                WHERE c.user_id = $1 AND c.unit_id = u.id))))::int AS n`,
    [userId, levelCode],
  );
}

/** perfect_lessons: lessons completed with 100% accuracy at least once. */
export function perfectLessons(db: Queryable, userId: number): Promise<number> {
  return valueOf(
    db,
    `SELECT count(*)::int AS n FROM lesson_progress WHERE user_id = $1 AND best_accuracy = 100`,
    [userId],
  );
}

/** reviews_in_day: review answers on the learner's current local date (users.time_zone). */
export function reviewsInDay(db: Queryable, userId: number): Promise<number> {
  return valueOf(
    db,
    `SELECT count(*)::int AS n FROM review_log r
       JOIN users u ON u.id = r.user_id
      WHERE r.user_id = $1
        AND r.answered_at >= ((now() AT TIME ZONE u.time_zone)::date::timestamp
                              AT TIME ZONE u.time_zone)`,
    [userId],
  );
}

/**
 * xp_in_week: XP earned this week, across courses. The week is the leaderboard's (FR-180):
 * Monday 00:00 in the server's time zone `timeZone`, as social/queries.ts computes it.
 */
export function xpInWeek(db: Queryable, userId: number, timeZone: string): Promise<number> {
  return valueOf(
    db,
    `SELECT COALESCE(sum(amount), 0)::int AS n FROM xp_events
      WHERE user_id = $1
        AND earned_at >= (date_trunc('week', now() AT TIME ZONE $2) AT TIME ZONE $2)`,
    [userId, timeZone],
  );
}

/** characters_drawn: distinct characters drawn from memory in completed lessons. */
export function charactersDrawn(db: Queryable, userId: number): Promise<number> {
  return valueOf(db, `SELECT count(*)::int AS n FROM drawn_characters WHERE user_id = $1`, [
    userId,
  ]);
}

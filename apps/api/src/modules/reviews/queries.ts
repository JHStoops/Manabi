import type { ReviewSessionState } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { insertReturning, query, queryOne } from '../../db/db';
import type { ExerciseRow, ItemRow } from '../content/rows';
import type { ItemProgressRow, ReviewLogRow, ReviewSessionRow, Stage } from './rows';

// Hand-written, parameterized SQL for review progress, review sessions and the review log. The
// log is append-only (DR-04): there are no UPDATE or DELETE statements against review_log, and
// the database rejects them.

export interface NewItemProgress {
  userId: number;
  itemId: number;
  facet: string;
  stage: Stage;
  /** Null only for stage 8 (Retired). */
  dueAt: Date | null;
}

export function insertItemProgress(db: Queryable, p: NewItemProgress): Promise<ItemProgressRow> {
  return insertReturning<ItemProgressRow>(
    db,
    `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [p.userId, p.itemId, p.facet, p.stage, p.dueAt],
  );
}

/**
 * SDD section 7: due item facets for one learner, oldest due first. Served by
 * item_progress_user_due_idx (user_id, due_at). Exported so tests can EXPLAIN it.
 */
export const DUE_FACETS_SQL = `SELECT * FROM item_progress
  WHERE user_id = $1 AND due_at <= $2
  ORDER BY due_at
  LIMIT $3`;

export function listDueFacets(
  db: Queryable,
  userId: number,
  now: Date,
  limit: number,
): Promise<ItemProgressRow[]> {
  return query<ItemProgressRow>(db, DUE_FACETS_SQL, [userId, now, limit]);
}

export interface NewReviewLog {
  userId: number;
  itemId: number;
  facet: string;
  exerciseType: string;
  correct: boolean;
  stageBefore: Stage;
  stageAfter: Stage;
}

export function insertReviewLog(db: Queryable, r: NewReviewLog): Promise<ReviewLogRow> {
  return insertReturning<ReviewLogRow>(
    db,
    `INSERT INTO review_log
       (user_id, item_id, facet, exercise_type, correct, stage_before, stage_after)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [r.userId, r.itemId, r.facet, r.exerciseType, r.correct, r.stageBefore, r.stageAfter],
  );
}

/**
 * FR-110: a review entry per facet for each item, at `stage` and due at `dueAt`. Entries that
 * exist already (a replayed lesson) keep their progress.
 */
export async function insertReviewEntries(
  db: Queryable,
  userId: number,
  entries: readonly { itemId: number; facet: string }[],
  stage: Stage,
  dueAt: Date,
): Promise<void> {
  await query(
    db,
    `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
     SELECT $1, e.item_id, e.facet, $4, $5
       FROM unnest($2::bigint[], $3::text[]) AS e (item_id, facet)
     ON CONFLICT (user_id, item_id, facet) DO NOTHING`,
    [userId, entries.map((e) => e.itemId), entries.map((e) => e.facet), stage, dueAt],
  );
}

/** FR-110: the items that are in anyone's reviews, with their course's plugin. */
export function listItemsInReviews(db: Queryable): Promise<(ItemRow & { plugin: string })[]> {
  return query<ItemRow & { plugin: string }>(
    db,
    `SELECT i.*, c.plugin FROM items i JOIN courses c ON c.id = i.course_id
      WHERE i.archived_at IS NULL
        AND EXISTS (SELECT 1 FROM item_progress p WHERE p.item_id = i.id)`,
  );
}

/**
 * FR-110: each learner (or just `userId`) with any entry for one of these items gets an entry for each listed facet
 * of it they lack, copying the stage and due time of their lowest-stage entry (earliest due among
 * equals; a retired item stays retired). Policy: a facet a plugin adds starts at the item's
 * current stage, as the learner already knows the item; a facet that should start over must not
 * rely on this.
 */
export async function insertMissingFacets(
  db: Queryable,
  facets: readonly { itemId: number; facet: string }[],
  /** Only this learner's entries; every learner's when absent. */
  userId?: number,
): Promise<void> {
  await query(
    db,
    `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
     SELECT DISTINCT ON (p.user_id, p.item_id, f.facet) p.user_id, p.item_id, f.facet, p.stage, p.due_at
       FROM unnest($1::bigint[], $2::text[]) AS f (item_id, facet)
       JOIN item_progress p ON p.item_id = f.item_id AND ($3::bigint IS NULL OR p.user_id = $3)
      WHERE NOT EXISTS (SELECT 1 FROM item_progress e
                         WHERE e.user_id = p.user_id AND e.item_id = p.item_id AND e.facet = f.facet)
      ORDER BY p.user_id, p.item_id, f.facet, p.stage, p.due_at
     ON CONFLICT (user_id, item_id, facet) DO NOTHING`,
    [facets.map((f) => f.itemId), facets.map((f) => f.facet), userId ?? null],
  );
}

/**
 * A due item with one of its due facets, its course's plugin and the level of the section that
 * first teaches it (generators depend on it, FR-141; imported items may have no level).
 */
export type DueFacetRow = ItemRow & { facet: string; plugin: string; section_level: string | null };

/**
 * FR-114: the due facets of the learner's oldest due items (by their first due facet), `limit`
 * items from `offset`, oldest first, an item's facets together. Archived items are left out.
 * Served by item_progress_user_due_idx.
 */
export function listDueItemFacets(
  db: Queryable,
  userId: number,
  now: Date,
  limit: number,
  offset: number,
): Promise<DueFacetRow[]> {
  return query<DueFacetRow>(
    db,
    `WITH due AS (
       SELECT p.item_id, min(p.due_at) AS first_due
         FROM item_progress p
         JOIN items i ON i.id = p.item_id AND i.archived_at IS NULL
        WHERE p.user_id = $1 AND p.due_at <= $2
        GROUP BY p.item_id
        ORDER BY first_due, p.item_id
        LIMIT $3 OFFSET $4
     )
     SELECT i.*, p.facet, c.plugin,
            (SELECT s.level_code FROM lesson_items li
               JOIN lessons l ON l.id = li.lesson_id
               JOIN units u ON u.id = l.unit_id
               JOIN sections s ON s.id = u.section_id
              WHERE li.item_id = i.id
              ORDER BY s.position, u.position, l.position
              LIMIT 1) AS section_level
       FROM due
       JOIN item_progress p ON p.user_id = $1 AND p.item_id = due.item_id AND p.due_at <= $2
       JOIN items i ON i.id = due.item_id
       JOIN courses c ON c.id = i.course_id
      ORDER BY due.first_due, due.item_id, p.facet`,
    [userId, now, limit, offset],
  );
}

/** FR-048: the learner's items in reviews in a course; review distractors come only from these. */
export function listLearnedItems(
  db: Queryable,
  userId: number,
  courseId: number,
): Promise<ItemRow[]> {
  return query<ItemRow>(
    db,
    `SELECT i.* FROM items i
      WHERE i.course_id = $2 AND i.archived_at IS NULL
        AND EXISTS (SELECT 1 FROM item_progress p WHERE p.user_id = $1 AND p.item_id = i.id)
      ORDER BY i.id`,
    [userId, courseId],
  );
}

/**
 * SDD section 6: the stored exercises that review an item: its item-level exercises, and those of
 * a lesson that teaches only that item (a grammar point's pool). Active ones only: archived
 * lessons, units and sections are skipped (FR-232), as findStoredExercise does.
 */
export function listStoredReviewExercises(
  db: Queryable,
  itemIds: readonly number[],
): Promise<(ExerciseRow & { for_item_id: number })[]> {
  return query<ExerciseRow & { for_item_id: number }>(
    db,
    `SELECT e.*, e.item_id AS for_item_id
       FROM exercises e
      WHERE e.item_id = ANY($1::bigint[]) AND e.archived_at IS NULL
     UNION ALL
     SELECT e.*, sole.item_id AS for_item_id
       FROM (SELECT lesson_id, min(item_id) AS item_id FROM lesson_items
              GROUP BY lesson_id HAVING count(*) = 1) sole
       JOIN lessons l ON l.id = sole.lesson_id AND l.archived_at IS NULL
       JOIN units u ON u.id = l.unit_id AND u.archived_at IS NULL
       JOIN sections s ON s.id = u.section_id AND s.archived_at IS NULL
       JOIN exercises e ON e.lesson_id = sole.lesson_id AND e.item_id IS NULL
                       AND e.archived_at IS NULL
      WHERE sole.item_id = ANY($1::bigint[])
      ORDER BY id`,
    [itemIds],
  );
}

/** Serializes starting a review session per learner, so a double start makes one session. */
export async function lockReviewSessions(db: Queryable, userId: number): Promise<void> {
  await query(db, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    `review_session:${userId}`,
  ]);
}

/** FR-114: the learner's unexpired review session, kept for another 24 hours from now. */
export function resumeReviewSession(
  db: Queryable,
  userId: number,
): Promise<ReviewSessionRow | null> {
  return queryOne<ReviewSessionRow>(
    db,
    `UPDATE review_sessions
        SET expires_at = now() + interval '24 hours', updated_at = now()
      WHERE user_id = $1 AND expires_at > now()
      RETURNING *`,
    [userId],
  );
}

/** Replaces the learner's review session (expired, or finished) with a new one. */
export async function replaceReviewSession(
  db: Queryable,
  userId: number,
  state: ReviewSessionState,
): Promise<ReviewSessionRow> {
  await query(db, `DELETE FROM review_sessions WHERE user_id = $1`, [userId]);
  return insertReturning<ReviewSessionRow>(
    db,
    `INSERT INTO review_sessions (user_id, state, expires_at)
     VALUES ($1, $2, now() + interval '24 hours')
     RETURNING *`,
    [userId, state],
  );
}

/** The learner's own unexpired review session, locked for this transaction. */
export function lockOwnReviewSession(
  db: Queryable,
  userId: number,
  sessionId: number,
): Promise<ReviewSessionRow | null> {
  return queryOne<ReviewSessionRow>(
    db,
    `SELECT * FROM review_sessions
      WHERE id = $1 AND user_id = $2 AND expires_at > now()
      FOR UPDATE`,
    [sessionId, userId],
  );
}

export async function saveReviewSessionState(
  db: Queryable,
  sessionId: number,
  state: ReviewSessionState,
): Promise<void> {
  await query(db, `UPDATE review_sessions SET state = $2, updated_at = now() WHERE id = $1`, [
    sessionId,
    state,
  ]);
}

export async function deleteReviewSession(db: Queryable, sessionId: number): Promise<void> {
  await query(db, `DELETE FROM review_sessions WHERE id = $1`, [sessionId]);
}

/** One facet's answer: counts it and marks the review time; returns the row, locked. */
export function recordFacetAnswer(
  db: Queryable,
  userId: number,
  itemId: number,
  facet: string,
  correct: boolean,
): Promise<ItemProgressRow | null> {
  return queryOne<ItemProgressRow>(
    db,
    `UPDATE item_progress
        SET correct_count = correct_count + $4::int, wrong_count = wrong_count + 1 - $4::int,
            last_reviewed_at = now()
      WHERE user_id = $1 AND item_id = $2 AND facet = $3
      RETURNING *`,
    [userId, itemId, facet, correct ? 1 : 0],
  );
}

/** FR-112: moves every entry of the learner's item to `stage`, due at `dueAt`. */
export async function setItemStage(
  db: Queryable,
  userId: number,
  itemId: number,
  stage: Stage,
  dueAt: Date | null,
): Promise<void> {
  await query(
    db,
    `UPDATE item_progress SET stage = $3, due_at = $4 WHERE user_id = $1 AND item_id = $2`,
    [userId, itemId, stage, dueAt],
  );
}

/** FR-113: the learner's active items with a facet due at `now`. */
export async function countDueItems(db: Queryable, userId: number, now: Date): Promise<number> {
  const row = await queryOne<{ count: number }>(
    db,
    `SELECT count(DISTINCT p.item_id)::int AS count
       FROM item_progress p
       JOIN items i ON i.id = p.item_id AND i.archived_at IS NULL
      WHERE p.user_id = $1 AND p.due_at <= $2`,
    [userId, now],
  );
  return row?.count ?? 0;
}

/**
 * FR-113: for today and the next 6 days in the learner's time zone, the items whose first facet
 * not yet due comes due that day.
 */
export function forecastDueItems(
  db: Queryable,
  userId: number,
  now: Date,
): Promise<{ date: string; count: number }[]> {
  return query<{ date: string; count: number }>(
    db,
    `WITH tz AS (SELECT time_zone FROM users WHERE id = $1),
     coming AS (
       SELECT (min(p.due_at) AT TIME ZONE tz.time_zone)::date AS day
         FROM item_progress p
         JOIN items i ON i.id = p.item_id AND i.archived_at IS NULL
         CROSS JOIN tz
        WHERE p.user_id = $1 AND p.due_at > $2
        GROUP BY p.item_id, tz.time_zone
     )
     SELECT to_char(today + n, 'YYYY-MM-DD') AS date,
            (SELECT count(*)::int FROM coming WHERE coming.day = today + n) AS count
       FROM (SELECT ($2::timestamptz AT TIME ZONE tz.time_zone)::date AS today FROM tz) t,
            generate_series(0, 6) AS n
      ORDER BY n`,
    [userId, now],
  );
}

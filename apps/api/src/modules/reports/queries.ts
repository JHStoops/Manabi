import type { Queryable } from '../../db/db';
import { insertReturning, query, queryOne } from '../../db/db';
import type { ExerciseRow, JsonObject } from '../content/rows';

// Hand-written, parameterized SQL for answer reports (FR-054, FR-229). Nothing here writes to a
// progress table.

export interface AnswerReportRow {
  id: number;
  user_id: number | null;
  exercise_id: number | null;
  item_id: number | null;
  lesson_id: number | null;
  exercise_type: string;
  exercise_payload: JsonObject;
  given_answer: string;
  status: 'open' | 'accepted' | 'dismissed';
  resolved_by: number | null;
  resolved_at: Date | null;
  created_at: Date;
}

/** A report with what the inbox shows next to it. */
export interface InboxReportRow extends AnswerReportRow {
  reporter: string | null;
  current_accept: unknown;
  course_id: number;
  course_title: string;
  plugin: string;
}

/** Serializes filing per learner, so a double tap files one report. */
export async function lockUserReports(db: Queryable, userId: number): Promise<void> {
  await query(db, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    `answer_report:${userId}`,
  ]);
}

/** A lesson or test-out session of the learner, with its lesson (none for a test-out) and course. */
export function findLessonSession(
  db: Queryable,
  userId: number,
  sessionId: number,
): Promise<{ state: unknown; lesson_id: number | null; course_id: number; plugin: string } | null> {
  return queryOne(
    db,
    `SELECT ls.state, ls.lesson_id, c.id AS course_id, c.plugin
       FROM lesson_sessions ls
       LEFT JOIN lessons l ON l.id = ls.lesson_id
       JOIN units u ON u.id = coalesce(l.unit_id, ls.unit_id)
       JOIN sections s ON s.id = u.section_id
       JOIN courses c ON c.id = s.course_id
      WHERE ls.id = $1 AND ls.user_id = $2`,
    [sessionId, userId],
  );
}

/** The learner's review session; each of its exercises names its course and plugin. */
export function findReviewSession(
  db: Queryable,
  userId: number,
  sessionId: number,
): Promise<{ state: unknown } | null> {
  return queryOne(db, `SELECT state FROM review_sessions WHERE id = $1 AND user_id = $2`, [
    sessionId,
    userId,
  ]);
}

/**
 * The stored exercise a report on `payload` is about, in the context it was played in: a lesson
 * (`lessonId`), or else a review or test-out of `itemId`. First an active exercise of the course
 * (of the lesson, for a lesson) with an equal payload (jsonb equality ignores key order). Else one
 * that differs only in its accept list: the copy an accepted report pinned, or an authored
 * exercise whose list the author extended since the session was built. For a review or test-out
 * that second match is among the item's own item-level exercises, so a pin in some lesson is
 * never extended for a review, nor the other way round.
 */
export async function findStoredExercise(
  db: Queryable,
  c: { courseId: number; lessonId: number | null; itemId: number | null },
  type: string,
  payload: JsonObject,
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    db,
    `WITH course_exercises AS (
       SELECT e.* FROM exercises e
         LEFT JOIN lessons l ON l.id = e.lesson_id
         LEFT JOIN units u ON u.id = l.unit_id
         LEFT JOIN sections s ON s.id = u.section_id
         LEFT JOIN items i ON i.id = e.item_id
        WHERE e.archived_at IS NULL AND e.origin IN ('authored', 'pinned')
          AND l.archived_at IS NULL AND u.archived_at IS NULL AND s.archived_at IS NULL
          AND i.archived_at IS NULL
          AND coalesce(s.course_id, i.course_id) = $1 AND e.type = $4
          AND ($2::bigint IS NULL OR e.lesson_id = $2)
     )
     SELECT id FROM (
       (SELECT id, 0 AS rank FROM course_exercises
         WHERE payload = $5::jsonb
         ORDER BY id LIMIT 1)
       UNION ALL
       (SELECT id, 1 FROM course_exercises
         WHERE (payload - 'accept') = ($5::jsonb - 'accept')
           AND ($2::bigint IS NOT NULL OR (lesson_id IS NULL AND item_id = $3))
         ORDER BY origin = 'pinned' DESC, id LIMIT 1)
     ) found
     ORDER BY rank LIMIT 1`,
    [c.courseId, c.lessonId, c.itemId, type, payload],
  );
  return row?.id ?? null;
}

/** The learner's open report of the same exercise and answer, if they already filed one. */
export function findOpenDuplicate(
  db: Queryable,
  r: { userId: number; type: string; payload: JsonObject; answer: string },
): Promise<AnswerReportRow | null> {
  return queryOne<AnswerReportRow>(
    db,
    `SELECT * FROM answer_reports
      WHERE user_id = $1 AND status = 'open' AND exercise_type = $2
        AND exercise_payload = $3::jsonb AND given_answer = $4
      ORDER BY id LIMIT 1`,
    [r.userId, r.type, r.payload, r.answer],
  );
}

export function insertReport(
  db: Queryable,
  r: {
    userId: number;
    exerciseId: number | null;
    itemId: number | null;
    lessonId: number | null;
    type: string;
    payload: JsonObject;
    answer: string;
  },
): Promise<AnswerReportRow> {
  return insertReturning<AnswerReportRow>(
    db,
    `INSERT INTO answer_reports
       (user_id, exercise_id, item_id, lesson_id, exercise_type, exercise_payload, given_answer)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [r.userId, r.exerciseId, r.itemId, r.lessonId, r.type, r.payload, r.answer],
  );
}

// The inbox row: the report, its reporter, the stored exercise's accept list and the course,
// reached through the report's (or its exercise's) item or lesson.
const INBOX_SELECT = `
  SELECT r.*, u.username AS reporter, e.payload -> 'accept' AS current_accept,
         c.id AS course_id, c.title AS course_title, c.plugin
    FROM answer_reports r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN exercises e ON e.id = r.exercise_id
    LEFT JOIN items i ON i.id = coalesce(r.item_id, e.item_id)
    LEFT JOIN lessons l ON l.id = coalesce(r.lesson_id, e.lesson_id)
    LEFT JOIN units un ON un.id = l.unit_id
    LEFT JOIN sections s ON s.id = un.section_id
    JOIN courses c ON c.id = coalesce(s.course_id, i.course_id)`;

/** FR-229: reports of one status, oldest first, after the report `afterId`. */
export function listReports(
  db: Queryable,
  p: { status: string; afterId: number | null; limit: number },
): Promise<InboxReportRow[]> {
  return query<InboxReportRow>(
    db,
    `${INBOX_SELECT}
      WHERE r.status = $1 AND ($2::bigint IS NULL OR r.id > $2)
      ORDER BY r.id
      LIMIT $3`,
    [p.status, p.afterId, p.limit],
  );
}

export function findInboxReport(db: Queryable, id: number): Promise<InboxReportRow | null> {
  return queryOne<InboxReportRow>(db, `${INBOX_SELECT} WHERE r.id = $1`, [id]);
}

/** The report, locked for resolving. */
export function lockReport(db: Queryable, id: number): Promise<AnswerReportRow | null> {
  return queryOne<AnswerReportRow>(db, `SELECT * FROM answer_reports WHERE id = $1 FOR UPDATE`, [
    id,
  ]);
}

/** A stored exercise with its course's plugin, locked for changing its accept list. */
export function lockExercise(
  db: Queryable,
  id: number,
): Promise<(ExerciseRow & { plugin: string }) | null> {
  return queryOne(
    db,
    `SELECT e.*, c.plugin
       FROM exercises e
       LEFT JOIN lessons l ON l.id = e.lesson_id
       LEFT JOIN units u ON u.id = l.unit_id
       LEFT JOIN sections s ON s.id = u.section_id
       LEFT JOIN items i ON i.id = e.item_id
       JOIN courses c ON c.id = coalesce(s.course_id, i.course_id)
      WHERE e.id = $1
        FOR UPDATE OF e`,
    [id],
  );
}

/** Whether the lesson, its unit and its section are active (not archived). */
export async function isActiveLesson(db: Queryable, lessonId: number): Promise<boolean> {
  const row = await queryOne(
    db,
    `SELECT 1 FROM lessons l
       JOIN units u ON u.id = l.unit_id
       JOIN sections s ON s.id = u.section_id
      WHERE l.id = $1 AND l.archived_at IS NULL AND u.archived_at IS NULL
        AND s.archived_at IS NULL`,
    [lessonId],
  );
  return row !== null;
}

export async function isActiveItem(db: Queryable, itemId: number): Promise<boolean> {
  const row = await queryOne(db, `SELECT 1 FROM items WHERE id = $1 AND archived_at IS NULL`, [
    itemId,
  ]);
  return row !== null;
}

/** FR-229: a generated exercise pinned at item level, where reviews find it (SDD section 6). */
export function insertItemExercise(
  db: Queryable,
  e: { itemId: number; type: string; payload: JsonObject },
): Promise<ExerciseRow> {
  return insertReturning<ExerciseRow>(
    db,
    `INSERT INTO exercises (item_id, type, origin, payload)
     VALUES ($1, $2, 'pinned', $3)
     RETURNING *`,
    [e.itemId, e.type, e.payload],
  );
}

/**
 * Points the other open reports of the same generated exercise, played in the same context (the
 * same lesson, or else the same item outside lessons), at the exercise that pinned it, so
 * accepting them extends that exercise instead of pinning it again.
 */
export async function linkOpenReports(
  db: Queryable,
  r: {
    type: string;
    payload: JsonObject;
    lessonId: number | null;
    itemId: number | null;
    exerciseId: number;
  },
): Promise<void> {
  await query(
    db,
    `UPDATE answer_reports SET exercise_id = $5
      WHERE exercise_id IS NULL AND status = 'open'
        AND exercise_type = $1 AND exercise_payload = $2::jsonb
        AND lesson_id IS NOT DISTINCT FROM $3
        AND ($3::bigint IS NOT NULL OR item_id = $4)`,
    [r.type, r.payload, r.lessonId, r.itemId, r.exerciseId],
  );
}

/** Serializes resolving reports, so two accepts of one generated exercise pin it once. */
export async function lockResolving(db: Queryable): Promise<void> {
  await query(db, `SELECT pg_advisory_xact_lock(hashtextextended('answer_report:resolve', 0))`);
}

export function updateExercisePayload(
  db: Queryable,
  id: number,
  payload: JsonObject,
): Promise<ExerciseRow> {
  return insertReturning<ExerciseRow>(
    db,
    `UPDATE exercises SET payload = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, payload],
  );
}

/** Closes an open report as accepted or dismissed by the admin. */
export async function resolveReport(
  db: Queryable,
  r: { id: number; status: 'accepted' | 'dismissed'; resolvedBy: number; exerciseId?: number },
): Promise<void> {
  await query(
    db,
    `UPDATE answer_reports
        SET status = $2, resolved_by = $3, resolved_at = now(),
            exercise_id = coalesce($4, exercise_id)
      WHERE id = $1`,
    [r.id, r.status, r.resolvedBy, r.exerciseId ?? null],
  );
}

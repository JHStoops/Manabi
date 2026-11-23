import type { LessonSessionState, LessonType } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { insertReturning, query, queryOne } from '../../db/db';
import type { ExerciseRow, ItemRow, SentenceRow } from '../content/rows';
import type { LessonSessionRow } from './rows';

// Hand-written, parameterized SQL for lesson sessions (FR-041, FR-048, FR-050, FR-056).

/** A lesson with what building its session needs from its section and course. */
export interface LessonContextRow {
  id: number;
  type: LessonType;
  course_id: number;
  plugin: string;
  level_code: string;
}

export function findLesson(db: Queryable, lessonId: number): Promise<LessonContextRow | null> {
  return queryOne<LessonContextRow>(
    db,
    `SELECT l.id, l.type, s.course_id, c.plugin, s.level_code
       FROM lessons l
       JOIN units u ON u.id = l.unit_id
       JOIN sections s ON s.id = u.section_id
       JOIN courses c ON c.id = s.course_id
      WHERE l.id = $1`,
    [lessonId],
  );
}

/** Serializes start-or-resume per learner and lesson, so a double start makes one session. */
export async function lockLessonSessions(db: Queryable, userId: number, lessonId: number) {
  await query(db, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    `lesson_session:${userId}:${lessonId}`,
  ]);
}

/**
 * FR-050: the learner's newest unexpired session for the lesson, kept for another 24 hours from
 * now, since the 24 hours count from when the learner last came back to it.
 */
export function resumeOpenSession(
  db: Queryable,
  userId: number,
  lessonId: number,
): Promise<LessonSessionRow | null> {
  return queryOne<LessonSessionRow>(
    db,
    `UPDATE lesson_sessions
        SET expires_at = now() + interval '24 hours', updated_at = now()
      WHERE id = (SELECT id FROM lesson_sessions
                   WHERE user_id = $1 AND lesson_id = $2 AND expires_at > now()
                   ORDER BY id DESC
                   LIMIT 1)
      RETURNING *`,
    [userId, lessonId],
  );
}

/** FR-023: whether the learner is enrolled in the course. */
export async function isEnrolled(db: Queryable, userId: number, courseId: number) {
  const row = await queryOne(
    db,
    `SELECT 1 AS enrolled FROM enrollments WHERE user_id = $1 AND course_id = $2`,
    [userId, courseId],
  );
  return row !== null;
}

/** FR-050: a new session, resumable for 24 hours. */
export function insertSession(
  db: Queryable,
  userId: number,
  lessonId: number,
  state: LessonSessionState,
): Promise<LessonSessionRow> {
  return insertReturning<LessonSessionRow>(
    db,
    `INSERT INTO lesson_sessions (user_id, lesson_id, state, expires_at)
     VALUES ($1, $2, $3, now() + interval '24 hours')
     RETURNING *`,
    [userId, lessonId, state],
  );
}

/** FR-041: the lesson's new items in lesson order. */
export function listLessonItems(db: Queryable, lessonId: number): Promise<ItemRow[]> {
  return query<ItemRow>(
    db,
    `SELECT i.* FROM lesson_items li JOIN items i ON i.id = li.item_id
      WHERE li.lesson_id = $1 AND i.archived_at IS NULL
      ORDER BY li.position`,
    [lessonId],
  );
}

/**
 * FR-048: the items taught in this lesson and every lesson before it on the path (active and
 * published, as the learner sees the path).
 */
export function listTaughtItems(db: Queryable, lessonId: number): Promise<ItemRow[]> {
  return query<ItemRow>(
    db,
    `WITH cur AS (
       SELECT s.course_id, s.position AS sp, u.position AS up, l.position AS lp
         FROM lessons l
         JOIN units u ON u.id = l.unit_id
         JOIN sections s ON s.id = u.section_id
        WHERE l.id = $1
     )
     SELECT DISTINCT i.*
       FROM cur
       JOIN sections s ON s.course_id = cur.course_id AND s.archived_at IS NULL
       JOIN units u ON u.section_id = s.id AND u.archived_at IS NULL
       JOIN lessons l ON l.unit_id = u.id AND l.archived_at IS NULL
       JOIN lesson_items li ON li.lesson_id = l.id
       JOIN items i ON i.id = li.item_id AND i.archived_at IS NULL
      WHERE (s.position, u.position, l.position) <= (cur.sp, cur.up, cur.lp)
        AND (l.id = $1 OR (u.status = 'published' AND l.status = 'published'))
      ORDER BY i.id`,
    [lessonId],
  );
}

/** SDD section 6: the lesson's stored exercises (authored and pinned), pinned first. */
export function listStoredExercises(db: Queryable, lessonId: number): Promise<ExerciseRow[]> {
  return query<ExerciseRow>(
    db,
    `SELECT * FROM exercises
      WHERE lesson_id = $1 AND origin IN ('authored', 'pinned')
      ORDER BY origin = 'pinned' DESC, id`,
    [lessonId],
  );
}

/**
 * FR-056, FR-048: sentences of the lesson's items that generators may use. Vocabulary and grammar
 * levels are both at or below the section's level (a null level has nothing above it), ranking
 * levels by the course's section order; not marked challenging; and every linked item taught.
 * shortcut: capped at 100 sentences for NFR-02; pick by relevance when generators need more.
 */
export function listSentences(
  db: Queryable,
  courseId: number,
  levelCode: string,
  lessonItemIds: readonly number[],
  taughtItemIds: readonly number[],
): Promise<Pick<SentenceRow, 'id' | 'text' | 'tokens' | 'translation' | 'grammar'>[]> {
  return query(
    db,
    `WITH levels AS (
       SELECT level_code, min(position) AS rank
         FROM sections
        WHERE course_id = $1 AND archived_at IS NULL
        GROUP BY level_code
     ), allowed AS (
       SELECT level_code FROM levels
        WHERE rank <= (SELECT rank FROM levels WHERE level_code = $2)
     )
     SELECT s.id, s.text, s.tokens, s.translation, s.grammar
       FROM sentences s
      WHERE s.course_id = $1 AND s.archived_at IS NULL
        AND s.challenge_override IS NOT TRUE
        AND (s.vocab_level_code IS NULL OR s.vocab_level_code IN (SELECT level_code FROM allowed))
        AND (s.grammar_level_code IS NULL
             OR s.grammar_level_code IN (SELECT level_code FROM allowed))
        AND EXISTS (SELECT 1 FROM sentence_items si
                     WHERE si.sentence_id = s.id AND si.item_id = ANY ($3::bigint[]))
        AND NOT EXISTS (SELECT 1 FROM sentence_items si
                         WHERE si.sentence_id = s.id AND si.item_id <> ALL ($4::bigint[]))
      ORDER BY s.id
      LIMIT 100`,
    [courseId, levelCode, lessonItemIds, taughtItemIds],
  );
}

/**
 * FR-051: locks the learner's session for completion; null for anyone else's (NFR-14). An expired
 * session still completes while its row exists: expiry (FR-050) only limits resuming.
 */
export function lockOwnSession(
  db: Queryable,
  userId: number,
  sessionId: number,
): Promise<LessonSessionRow | null> {
  return queryOne<LessonSessionRow>(
    db,
    `SELECT * FROM lesson_sessions
      WHERE id = $1 AND user_id = $2
      FOR UPDATE`,
    [sessionId, userId],
  );
}

/** FR-051: a completed session is used up, so it cannot be completed again. */
export async function deleteSession(db: Queryable, sessionId: number) {
  await query(db, `DELETE FROM lesson_sessions WHERE id = $1`, [sessionId]);
}

/** FR-020, FR-055: records a completion, keeping the first date and the best accuracy. */
export async function upsertLessonProgress(
  db: Queryable,
  userId: number,
  lessonId: number,
  accuracy: number,
) {
  await query(
    db,
    `INSERT INTO lesson_progress (user_id, lesson_id, completed_at, best_accuracy)
     VALUES ($1, $2, now(), $3)
     ON CONFLICT (user_id, lesson_id) DO UPDATE
       SET best_accuracy = GREATEST(lesson_progress.best_accuracy, EXCLUDED.best_accuracy),
           times_completed = lesson_progress.times_completed + 1`,
    [userId, lessonId, accuracy],
  );
}

/**
 * FR-021, FR-232: records the lesson's unit as finished once every visible (published, active)
 * lesson in it is completed. Insert-only; a unit finished before keeps its first completion.
 */
export async function insertUnitCompletionIfDone(db: Queryable, userId: number, lessonId: number) {
  await query(
    db,
    `INSERT INTO unit_completions (user_id, unit_id)
     SELECT $1, l.unit_id FROM lessons l
      WHERE l.id = $2
        AND NOT EXISTS (
          SELECT 1 FROM lessons o
           WHERE o.unit_id = l.unit_id AND o.archived_at IS NULL AND o.status = 'published'
             AND NOT EXISTS (SELECT 1 FROM lesson_progress p
                              WHERE p.user_id = $1 AND p.lesson_id = o.id))
     ON CONFLICT DO NOTHING`,
    [userId, lessonId],
  );
}

/** FR-052: serializes requests carrying the same learner's Idempotency-Key. */
export async function lockIdempotencyKey(db: Queryable, userId: number, key: string) {
  await query(db, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    `idempotency:${userId}:${key}`,
  ]);
}

/** FR-052: a request already applied under this key, and the response it got. */
export function findIdempotencyKey(
  db: Queryable,
  userId: number,
  key: string,
): Promise<{ request_hash: string; response: unknown } | null> {
  return queryOne(
    db,
    `SELECT request_hash, response FROM idempotency_keys WHERE user_id = $1 AND key = $2`,
    [userId, key],
  );
}

export async function insertIdempotencyKey(
  db: Queryable,
  userId: number,
  key: string,
  requestHash: string,
  response: object,
) {
  await query(
    db,
    `INSERT INTO idempotency_keys (user_id, key, request_hash, response) VALUES ($1, $2, $3, $4)`,
    [userId, key, requestHash, response],
  );
}

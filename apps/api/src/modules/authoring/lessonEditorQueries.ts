import type { Queryable } from '../../db/db';
import { insertReturning, query, queryOne } from '../../db/db';
import type { ExerciseRow, ItemRow, JsonObject, LessonRow } from '../content/rows';

// Hand-written, parameterized SQL for the lesson editor (FR-223, FR-224). Nothing here writes to
// a progress table.

/** What the editor needs from a lesson's section and course. */
export interface EditorLessonRow extends LessonRow {
  course_id: number;
  plugin: string;
  target_lang: string;
  level_code: string;
}

/** An active lesson in an active unit and section, with its course's plugin and language. */
export function findEditorLesson(db: Queryable, id: number): Promise<EditorLessonRow | null> {
  return queryOne(
    db,
    `SELECT l.*, s.course_id, c.plugin, c.target_lang, s.level_code
       FROM lessons l
       JOIN units u ON u.id = l.unit_id
       JOIN sections s ON s.id = u.section_id
       JOIN courses c ON c.id = s.course_id
      WHERE l.id = $1 AND l.archived_at IS NULL AND u.archived_at IS NULL
        AND s.archived_at IS NULL`,
    [id],
  );
}

/** How many of `ids` are active items of the course. */
export async function countCourseItems(
  db: Queryable,
  courseId: number,
  ids: readonly number[],
): Promise<number> {
  const row = await queryOne<{ n: number }>(
    db,
    `SELECT count(*)::int AS n FROM items
      WHERE course_id = $1 AND archived_at IS NULL AND id = ANY ($2::bigint[])`,
    [courseId, ids],
  );
  return row!.n;
}

/** An active exercise of an active lesson; with `lock`, locked until the transaction ends. */
export function findLessonExercise(
  db: Queryable,
  id: number,
  lock = false,
): Promise<ExerciseRow | null> {
  return queryOne<ExerciseRow>(
    db,
    `SELECT * FROM exercises
      WHERE id = $1 AND lesson_id IS NOT NULL AND archived_at IS NULL
        AND origin IN ('authored', 'pinned')
      ${lock ? 'FOR UPDATE' : ''}`,
    [id],
  );
}

/** What an item-level exercise's edits need from its item's course (#241). */
export interface EditorItemRow {
  id: number;
  course_id: number;
  plugin: string;
  target_lang: string;
}

/** An active item, with its course's plugin and language. */
export function findEditorItem(db: Queryable, id: number): Promise<EditorItemRow | null> {
  return queryOne(
    db,
    `SELECT i.id, i.course_id, c.plugin, c.target_lang
       FROM items i JOIN courses c ON c.id = i.course_id
      WHERE i.id = $1 AND i.archived_at IS NULL`,
    [id],
  );
}

/**
 * An active item-level exercise (one of no lesson), such as a review pin (FR-229); with `lock`,
 * locked until the transaction ends.
 */
export function findItemExercise(
  db: Queryable,
  id: number,
  lock = false,
): Promise<ExerciseRow | null> {
  return queryOne<ExerciseRow>(
    db,
    `SELECT * FROM exercises
      WHERE id = $1 AND lesson_id IS NULL AND item_id IS NOT NULL AND archived_at IS NULL
        AND origin IN ('authored', 'pinned')
      ${lock ? 'FOR UPDATE' : ''}`,
    [id],
  );
}

/** An item's active item-level exercises, oldest first. */
export function listItemExercises(db: Queryable, itemId: number): Promise<ExerciseRow[]> {
  return query<ExerciseRow>(
    db,
    `SELECT * FROM exercises
      WHERE item_id = $1 AND lesson_id IS NULL AND archived_at IS NULL
        AND origin IN ('authored', 'pinned')
      ORDER BY id`,
    [itemId],
  );
}

/**
 * A new exercise at the end of the lesson. Its key, `ex-<id>`, names it in a pack export (DR-02);
 * pack keys are author-chosen, so a clash fails the unique constraint instead of overwriting.
 */
export async function insertExercise(
  db: Queryable,
  e: {
    lessonId: number;
    type: string;
    origin: 'authored' | 'pinned';
    payload: JsonObject;
    /** A pin's generated original (#254); its accept list is dropped. Defaults to `payload`. */
    original?: JsonObject;
  },
): Promise<ExerciseRow> {
  // One statement, so a clash never leaves a row without its key.
  return insertReturning<ExerciseRow>(
    db,
    `WITH n AS (SELECT nextval(pg_get_serial_sequence('exercises', 'id')) AS id)
     INSERT INTO exercises (id, key, lesson_id, type, origin, payload, position, original_payload)
     OVERRIDING SYSTEM VALUE
     SELECT n.id, 'ex-' || n.id, $1, $2, $3, $4,
            (SELECT coalesce(max(position) + 1, 0) FROM exercises WHERE lesson_id = $1),
            CASE WHEN $3 = 'pinned' THEN $5::jsonb - 'accept' END
       FROM n
     RETURNING *`,
    [e.lessonId, e.type, e.origin, e.payload, e.original ?? e.payload],
  );
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

/** Fails with a foreign key error when an answer report refers to it (FR-225 pattern). */
export async function deleteExercise(db: Queryable, id: number): Promise<void> {
  await query(db, `DELETE FROM exercises WHERE id = $1`, [id]);
}

export async function archiveExercise(db: Queryable, id: number): Promise<void> {
  await query(db, `UPDATE exercises SET archived_at = now(), updated_at = now() WHERE id = $1`, [
    id,
  ]);
}

/**
 * #259: what an item-level pin is checked against: the item, with the level of the section that
 * first teaches it (as reviews generate with, FR-141; null for an item no lesson teaches).
 */
export function findPinItem(
  db: Queryable,
  id: number,
): Promise<(ItemRow & { section_level: string | null }) | null> {
  return queryOne(
    db,
    `SELECT i.*,
            (SELECT s.level_code
               FROM lesson_items li
               JOIN lessons l ON l.id = li.lesson_id
               JOIN units u ON u.id = l.unit_id
               JOIN sections s ON s.id = u.section_id
              WHERE li.item_id = i.id
              ORDER BY s.position, u.position, l.position
              LIMIT 1) AS section_level
       FROM items i
      WHERE i.id = $1 AND i.archived_at IS NULL`,
    [id],
  );
}

/** #259: a course's active items, every item a learner of it could have been taught. */
export function listCourseItems(db: Queryable, courseId: number): Promise<ItemRow[]> {
  return query<ItemRow>(
    db,
    `SELECT * FROM items WHERE course_id = $1 AND archived_at IS NULL ORDER BY id`,
    [courseId],
  );
}

/** #259: ties an active pin to a new generated original; its accept list is dropped. */
export function updateExerciseOriginal(
  db: Queryable,
  id: number,
  original: JsonObject,
): Promise<ExerciseRow | null> {
  return queryOne<ExerciseRow>(
    db,
    `UPDATE exercises SET original_payload = $2::jsonb - 'accept', updated_at = now()
      WHERE id = $1 AND origin = 'pinned' AND archived_at IS NULL
      RETURNING *`,
    [id, original],
  );
}

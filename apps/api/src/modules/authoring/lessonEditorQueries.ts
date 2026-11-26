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

/** The item picker: the course's active items whose key contains `text`, by key, at most 50. */
export function searchItems(
  db: Queryable,
  courseId: number,
  text: string,
  type: string | undefined,
): Promise<ItemRow[]> {
  return query<ItemRow>(
    db,
    `SELECT * FROM items
      WHERE course_id = $1 AND archived_at IS NULL
        AND strpos(lower(key), lower($2)) > 0 AND ($3::text IS NULL OR type = $3)
      ORDER BY key
      LIMIT 50`,
    [courseId, text, type ?? null],
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

/** An active exercise of an active lesson. */
export function findLessonExercise(db: Queryable, id: number): Promise<ExerciseRow | null> {
  return queryOne<ExerciseRow>(
    db,
    `SELECT * FROM exercises
      WHERE id = $1 AND lesson_id IS NOT NULL AND archived_at IS NULL
        AND origin IN ('authored', 'pinned')`,
    [id],
  );
}

/**
 * A new exercise at the end of the lesson. Its key, `ex-<id>`, names it in a pack export (DR-02);
 * pack keys are author-chosen, so a clash fails the unique constraint instead of overwriting.
 */
export async function insertExercise(
  db: Queryable,
  e: { lessonId: number; type: string; origin: 'authored' | 'pinned'; payload: JsonObject },
): Promise<ExerciseRow> {
  const { id } = await insertReturning<{ id: number }>(
    db,
    `INSERT INTO exercises (lesson_id, type, origin, payload, position)
     VALUES ($1, $2, $3, $4,
             (SELECT coalesce(max(position) + 1, 0) FROM exercises WHERE lesson_id = $1))
     RETURNING id`,
    [e.lessonId, e.type, e.origin, e.payload],
  );
  return insertReturning<ExerciseRow>(
    db,
    `UPDATE exercises SET key = 'ex-' || id WHERE id = $1 RETURNING *`,
    [id],
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

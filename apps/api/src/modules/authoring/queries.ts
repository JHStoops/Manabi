import type { LessonType, PublishStatus } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { insertReturning, query, queryOne } from '../../db/db';
import type { LessonRow, SectionRow, UnitRow } from '../content/rows';

// Hand-written, parameterized SQL for the course tree editor (FR-220, FR-225). Nothing here
// writes to a progress table.

/** The course's active lessons (in active units and sections), in path order. */
export function listTreeLessons(db: Queryable, courseId: number): Promise<LessonRow[]> {
  return query<LessonRow>(
    db,
    `SELECT l.*
       FROM lessons l JOIN units u ON u.id = l.unit_id JOIN sections s ON s.id = u.section_id
      WHERE s.course_id = $1 AND l.archived_at IS NULL
      ORDER BY l.unit_id, l.position`,
    [courseId],
  );
}

type WithCourse = { course_id: number };

export function findSection(db: Queryable, id: number): Promise<SectionRow | null> {
  return queryOne<SectionRow>(db, `SELECT * FROM sections WHERE id = $1 AND archived_at IS NULL`, [
    id,
  ]);
}

/** An active unit in an active section, with its course id. */
export function findUnit(db: Queryable, id: number): Promise<(UnitRow & WithCourse) | null> {
  return queryOne(
    db,
    `SELECT u.*, s.course_id
       FROM units u JOIN sections s ON s.id = u.section_id
      WHERE u.id = $1 AND u.archived_at IS NULL AND s.archived_at IS NULL`,
    [id],
  );
}

/** An active lesson in an active unit and section, with its course id. */
export function findLesson(db: Queryable, id: number): Promise<(LessonRow & WithCourse) | null> {
  return queryOne(
    db,
    `SELECT l.*, s.course_id
       FROM lessons l JOIN units u ON u.id = l.unit_id JOIN sections s ON s.id = u.section_id
      WHERE l.id = $1 AND l.archived_at IS NULL AND u.archived_at IS NULL
        AND s.archived_at IS NULL`,
    [id],
  );
}

// New rows go after every sibling, archived ones included, since archived rows keep their slot.

export async function insertSection(
  db: Queryable,
  s: { courseId: number; key: string; title: string; levelCode: string },
): Promise<void> {
  await insertReturning(
    db,
    `INSERT INTO sections (course_id, key, position, title, level_code)
     VALUES ($1, $2, (SELECT coalesce(max(position) + 1, 0) FROM sections WHERE course_id = $1),
             $3, $4)
     RETURNING id`,
    [s.courseId, s.key, s.title, s.levelCode],
  );
}

export async function insertUnit(
  db: Queryable,
  u: { sectionId: number; key: string; title: string },
): Promise<void> {
  await insertReturning(
    db,
    `INSERT INTO units (section_id, key, position, title)
     VALUES ($1, $2, (SELECT coalesce(max(position) + 1, 0) FROM units WHERE section_id = $1), $3)
     RETURNING id`,
    [u.sectionId, u.key, u.title],
  );
}

export async function insertLesson(
  db: Queryable,
  l: { unitId: number; key: string; type: LessonType; title: string },
): Promise<void> {
  await insertReturning(
    db,
    `INSERT INTO lessons (unit_id, key, position, type, title)
     VALUES ($1, $2, (SELECT coalesce(max(position) + 1, 0) FROM lessons WHERE unit_id = $1),
             $3, $4)
     RETURNING id`,
    [l.unitId, l.key, l.type, l.title],
  );
}

// Updates leave a field unchanged when its value is null.

export async function updateSection(
  db: Queryable,
  id: number,
  s: { title?: string; levelCode?: string },
): Promise<void> {
  await query(
    db,
    `UPDATE sections SET title = coalesce($2, title), level_code = coalesce($3, level_code),
            updated_at = now()
      WHERE id = $1`,
    [id, s.title ?? null, s.levelCode ?? null],
  );
}

export async function updateUnit(
  db: Queryable,
  id: number,
  u: { title?: string; status?: PublishStatus },
): Promise<void> {
  await query(
    db,
    `UPDATE units SET title = coalesce($2, title), status = coalesce($3, status),
            updated_at = now()
      WHERE id = $1`,
    [id, u.title ?? null, u.status ?? null],
  );
}

export async function updateLesson(
  db: Queryable,
  id: number,
  l: { title?: string; type?: LessonType; status?: PublishStatus },
): Promise<void> {
  await query(
    db,
    `UPDATE lessons SET title = coalesce($2, title), type = coalesce($3, type),
            status = coalesce($4, status), updated_at = now()
      WHERE id = $1`,
    [id, l.title ?? null, l.type ?? null, l.status ?? null],
  );
}

// Reordering: the sibling ids, active first in position order and archived ones after them, and
// a statement that numbers them 0, 1, 2... in the given order. Callers defer the position
// constraints (deferPositionChecks) for the swap.

type Sibling = { id: number; archived: boolean };

export function listSectionSiblings(db: Queryable, courseId: number): Promise<Sibling[]> {
  return query(
    db,
    `SELECT id, archived_at IS NOT NULL AS archived FROM sections WHERE course_id = $1
      ORDER BY archived_at IS NOT NULL, position`,
    [courseId],
  );
}

export function listUnitSiblings(db: Queryable, sectionId: number): Promise<Sibling[]> {
  return query(
    db,
    `SELECT id, archived_at IS NOT NULL AS archived FROM units WHERE section_id = $1
      ORDER BY archived_at IS NOT NULL, position`,
    [sectionId],
  );
}

export function listLessonSiblings(db: Queryable, unitId: number): Promise<Sibling[]> {
  return query(
    db,
    `SELECT id, archived_at IS NOT NULL AS archived FROM lessons WHERE unit_id = $1
      ORDER BY archived_at IS NOT NULL, position`,
    [unitId],
  );
}

export async function setSectionPositions(db: Queryable, ids: number[]): Promise<void> {
  await query(
    db,
    `UPDATE sections s SET position = o.n - 1, updated_at = now()
       FROM unnest($1::bigint[]) WITH ORDINALITY AS o (id, n) WHERE s.id = o.id`,
    [ids],
  );
}

export async function setUnitPositions(db: Queryable, ids: number[]): Promise<void> {
  await query(
    db,
    `UPDATE units u SET position = o.n - 1, updated_at = now()
       FROM unnest($1::bigint[]) WITH ORDINALITY AS o (id, n) WHERE u.id = o.id`,
    [ids],
  );
}

export async function setLessonPositions(db: Queryable, ids: number[]): Promise<void> {
  await query(
    db,
    `UPDATE lessons l SET position = o.n - 1, updated_at = now()
       FROM unnest($1::bigint[]) WITH ORDINALITY AS o (id, n) WHERE l.id = o.id`,
    [ids],
  );
}

// Deleting removes the row with its lessons' exercises and lesson items. Progress tables refer
// to lessons and units with ON DELETE RESTRICT, so the caller runs these in a savepoint and
// archives instead when they fail (FR-225).

export async function deleteSection(db: Queryable, id: number): Promise<void> {
  await query(
    db,
    `DELETE FROM exercises WHERE lesson_id IN
       (SELECT l.id FROM lessons l JOIN units u ON u.id = l.unit_id WHERE u.section_id = $1)`,
    [id],
  );
  await query(
    db,
    `DELETE FROM lessons WHERE unit_id IN (SELECT id FROM units WHERE section_id = $1)`,
    [id],
  );
  await query(db, `DELETE FROM units WHERE section_id = $1`, [id]);
  await query(db, `DELETE FROM sections WHERE id = $1`, [id]);
}

export async function deleteUnit(db: Queryable, id: number): Promise<void> {
  await query(
    db,
    `DELETE FROM exercises WHERE lesson_id IN (SELECT id FROM lessons WHERE unit_id = $1)`,
    [id],
  );
  await query(db, `DELETE FROM lessons WHERE unit_id = $1`, [id]);
  await query(db, `DELETE FROM units WHERE id = $1`, [id]);
}

export async function deleteLesson(db: Queryable, id: number): Promise<void> {
  await query(db, `DELETE FROM exercises WHERE lesson_id = $1`, [id]);
  await query(db, `DELETE FROM lessons WHERE id = $1`, [id]);
}

export async function archiveSection(db: Queryable, id: number): Promise<void> {
  await query(db, `UPDATE sections SET archived_at = now(), updated_at = now() WHERE id = $1`, [
    id,
  ]);
}

export async function archiveUnit(db: Queryable, id: number): Promise<void> {
  await query(db, `UPDATE units SET archived_at = now(), updated_at = now() WHERE id = $1`, [id]);
}

export async function archiveLesson(db: Queryable, id: number): Promise<void> {
  await query(db, `UPDATE lessons SET archived_at = now(), updated_at = now() WHERE id = $1`, [id]);
}

export async function savepoint(db: Queryable): Promise<void> {
  await query(db, `SAVEPOINT tree_delete`);
}

export async function rollbackToSavepoint(db: Queryable): Promise<void> {
  await query(db, `ROLLBACK TO SAVEPOINT tree_delete`);
}

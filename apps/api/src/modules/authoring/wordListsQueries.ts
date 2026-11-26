import type { Queryable } from '../../db/db';
import { insertReturning, query, queryOne } from '../../db/db';

// FR-234, FR-237: hand-written SQL for the supplementary words and the blocklist.

export interface SupplementaryWordRow {
  id: number;
  course: string;
  level: string;
  written: string;
  reading: string;
  note: string | null;
}

const SUPPLEMENTARY = `SELECT w.id, c.key AS course, w.level_code AS level, w.written, w.reading, w.note
  FROM supplementary_words w JOIN courses c ON c.id = w.course_id`;

export function listSupplementaryWords(
  db: Queryable,
  course: string | null,
  level: string | null,
): Promise<SupplementaryWordRow[]> {
  return query(
    db,
    `${SUPPLEMENTARY}
     WHERE ($1::text IS NULL OR c.key = $1) AND ($2::text IS NULL OR w.level_code = $2)
     ORDER BY c.key, w.level_code DESC, w.written COLLATE "C", w.reading COLLATE "C"`,
    [course, level],
  );
}

export function findSupplementaryWord(
  db: Queryable,
  id: number,
): Promise<SupplementaryWordRow | null> {
  return queryOne(db, `${SUPPLEMENTARY} WHERE w.id = $1`, [id]);
}

/** The id of the course with this key, when it has a section at `level` (as the pack import checks). */
export async function findCourseWithLevel(
  db: Queryable,
  key: string,
  level: string,
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    db,
    `SELECT c.id FROM courses c WHERE c.key = $1
       AND EXISTS (SELECT 1 FROM sections s WHERE s.course_id = c.id AND s.level_code = $2)`,
    [key, level],
  );
  return row?.id ?? null;
}

export async function insertSupplementaryWord(
  db: Queryable,
  w: { courseId: number; level: string; written: string; reading: string; note: string | null },
): Promise<number> {
  const row = await insertReturning<{ id: number }>(
    db,
    `INSERT INTO supplementary_words (course_id, level_code, written, reading, note)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [w.courseId, w.level, w.written, w.reading, w.note],
  );
  return row.id;
}

export async function updateSupplementaryWord(
  db: Queryable,
  id: number,
  w: { level: string; written: string; reading: string; note: string | null },
): Promise<void> {
  await query(
    db,
    `UPDATE supplementary_words SET level_code = $2, written = $3, reading = $4, note = $5
      WHERE id = $1`,
    [id, w.level, w.written, w.reading, w.note],
  );
}

export async function deleteSupplementaryWord(db: Queryable, id: number): Promise<boolean> {
  return (
    (await queryOne(db, `DELETE FROM supplementary_words WHERE id = $1 RETURNING id`, [id])) !==
    null
  );
}

export interface BlockedWordRow {
  id: number;
  lang: string;
  word: string;
}

export function listBlockedWords(db: Queryable, lang: string | null): Promise<BlockedWordRow[]> {
  return query(
    db,
    `SELECT id, lang, word FROM blocked_words WHERE ($1::text IS NULL OR lang = $1)
     ORDER BY lang, word COLLATE "C"`,
    [lang],
  );
}

export function insertBlockedWord(
  db: Queryable,
  lang: string,
  word: string,
): Promise<BlockedWordRow> {
  return insertReturning(
    db,
    `INSERT INTO blocked_words (lang, word) VALUES ($1, $2) RETURNING id, lang, word`,
    [lang, word],
  );
}

export async function deleteBlockedWord(db: Queryable, id: number): Promise<boolean> {
  return (
    (await queryOne(db, `DELETE FROM blocked_words WHERE id = $1 RETURNING id`, [id])) !== null
  );
}

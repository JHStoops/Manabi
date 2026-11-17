import type { Queryable } from '../../db/db';
import { insertReturning, query } from '../../db/db';
import type { JsonObject } from '../content/rows';
import type { ImportedItem, LevelWord } from '@manabi/importers';

// Dataset imports (FR-226, SDD section 10). Nothing here touches a progress table.

export async function insertImportRun(db: Queryable, importer: string): Promise<number> {
  const row = await insertReturning<{ id: number }>(
    db,
    `INSERT INTO import_runs (importer) VALUES ($1) RETURNING id`,
    [importer],
  );
  return row.id;
}

export async function finishImportRun(
  db: Queryable,
  id: number,
  status: 'succeeded' | 'failed',
  summary: JsonObject,
): Promise<void> {
  await query(
    db,
    `UPDATE import_runs SET status = $2, summary = $3, finished_at = now() WHERE id = $1`,
    [id, status, summary],
  );
}

export interface UpsertCounts {
  added: number;
  updated: number;
}

/**
 * Upserts imported items by stable key (DR-02) in one statement. Only `data` and
 * `dataset_version` change on update, and only when `data` differs, so overrides, level and
 * archive state are kept (DR-09) and an identical re-run writes nothing. A key held by an
 * authored item or another course's item is left alone.
 */
export async function upsertImportedItems(
  db: Queryable,
  i: { courseId: number; source: string; datasetVersion: string; items: ImportedItem[] },
): Promise<UpsertCounts> {
  const [row] = await query<{ added: number; updated: number }>(
    db,
    `WITH upserted AS (
       INSERT INTO items (course_id, key, type, data, source, dataset_version)
       SELECT $1, t.key, t.type, t.data::jsonb, $2, $3
       FROM unnest($4::text[], $5::text[], $6::text[]) AS t (key, type, data)
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data,
         dataset_version = EXCLUDED.dataset_version, updated_at = now()
       WHERE items.course_id = EXCLUDED.course_id AND items.source = EXCLUDED.source
         AND items.type = EXCLUDED.type AND items.data IS DISTINCT FROM EXCLUDED.data
       RETURNING xmax = 0 AS inserted)
     SELECT count(*) FILTER (WHERE inserted)::int AS added,
       count(*) FILTER (WHERE NOT inserted)::int AS updated
     FROM upserted`,
    [
      i.courseId,
      i.source,
      i.datasetVersion,
      i.items.map((item) => item.key),
      i.items.map((item) => item.type),
      i.items.map((item) => JSON.stringify(item.data)),
    ],
  );
  return row!;
}

/**
 * SDD section 10 step 2: sets `level_code` on the course's imported items with these keys.
 * Authored items keep the level their pack gives them. Returns how many rows changed.
 */
export async function setImportedItemLevels(
  db: Queryable,
  i: { courseId: number; levels: { key: string; level: string }[] },
): Promise<number> {
  const [row] = await query<{ updated: number }>(
    db,
    `WITH updated AS (
       UPDATE items SET level_code = t.level, updated_at = now()
       FROM unnest($2::text[], $3::text[]) AS t (key, level)
       WHERE items.key = t.key AND items.course_id = $1 AND items.source IS NOT NULL
         AND items.level_code IS DISTINCT FROM t.level
       RETURNING 1)
     SELECT count(*)::int AS updated FROM updated`,
    [i.courseId, i.levels.map((l) => l.key), i.levels.map((l) => l.level)],
  );
  return row!.updated;
}

/** Upserts level-list words by (course, written, reading); only a changed level is updated. */
export async function upsertLevelListWords(
  db: Queryable,
  i: { courseId: number; words: LevelWord[] },
): Promise<UpsertCounts> {
  const [row] = await query<{ added: number; updated: number }>(
    db,
    `WITH upserted AS (
       INSERT INTO level_list_words (course_id, level_code, written, reading)
       SELECT $1, t.level, t.written, t.reading
       FROM unnest($2::text[], $3::text[], $4::text[]) AS t (level, written, reading)
       ON CONFLICT (course_id, written, reading) DO UPDATE SET level_code = EXCLUDED.level_code
       WHERE level_list_words.level_code IS DISTINCT FROM EXCLUDED.level_code
       RETURNING xmax = 0 AS inserted)
     SELECT count(*) FILTER (WHERE inserted)::int AS added,
       count(*) FILTER (WHERE NOT inserted)::int AS updated
     FROM upserted`,
    [
      i.courseId,
      i.words.map((w) => w.level),
      i.words.map((w) => w.written),
      i.words.map((w) => w.reading),
    ],
  );
  return row!;
}

/** Keys among `keys` held by an authored item or by another course or source (left alone). */
export async function findKeysOwnedElsewhere(
  db: Queryable,
  i: { courseId: number; source: string; keys: string[] },
): Promise<string[]> {
  const rows = await query<{ key: string }>(
    db,
    `SELECT key FROM items WHERE key = ANY($3::text[])
       AND (course_id <> $1 OR source IS DISTINCT FROM $2)
     ORDER BY key`,
    [i.courseId, i.source, i.keys],
  );
  return rows.map((row) => row.key);
}

/**
 * SDD section 10 step 3: the words the JMdict import looks up, from the level lists and the
 * supplementary words (FR-234). A word on both keeps its level-list level.
 */
export function listWantedWords(db: Queryable, courseId: number): Promise<LevelWord[]> {
  return query<LevelWord>(
    db,
    `SELECT DISTINCT ON (written, reading) level, written, reading
     FROM (SELECT level_code AS level, written, reading, 0 AS rank
           FROM level_list_words WHERE course_id = $1
           UNION ALL
           SELECT level_code, written, reading, 1 FROM supplementary_words WHERE course_id = $1) w
     ORDER BY written, reading, rank`,
    [courseId],
  );
}

/**
 * Adds `contains` links from the course's imported words to its kanji items; pairs whose word or
 * kanji item does not exist are skipped. Returns how many links were added.
 */
export async function insertContainsLinks(
  db: Queryable,
  i: { courseId: number; source: string; links: { from: string; to: string }[] },
): Promise<number> {
  const [row] = await query<{ added: number }>(
    db,
    `WITH added AS (
       INSERT INTO item_links (from_item_id, to_item_id, kind)
       SELECT w.id, k.id, 'contains'
       FROM unnest($3::text[], $4::text[]) AS t (word, kanji)
       JOIN items w ON w.key = t.word AND w.course_id = $1 AND w.source = $2
       JOIN items k ON k.key = t.kanji AND k.course_id = $1 AND k.type = 'kanji'
       ON CONFLICT DO NOTHING
       RETURNING 1)
     SELECT count(*)::int AS added FROM added`,
    [i.courseId, i.source, i.links.map((l) => l.from), i.links.map((l) => l.to)],
  );
  return row!.added;
}

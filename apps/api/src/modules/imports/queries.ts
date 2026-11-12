import type { Queryable } from '../../db/db';
import { insertReturning, query } from '../../db/db';
import type { JsonObject } from '../content/rows';
import type { ImportedItem } from '@manabi/importers';

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

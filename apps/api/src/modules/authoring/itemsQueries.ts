import type { Queryable } from '../../db/db';
import { query, queryOne } from '../../db/db';
import type { JsonObject } from '../content/rows';

// FR-221: hand-written SQL for the item editor. Overrides are written by setItemOverrides in
// the content module's queries; imported `data` is never written here (DR-09).

export interface AuthoringItemRow {
  id: number;
  key: string;
  type: string;
  level_code: string | null;
  source: string | null;
  dataset_version: string | null;
  data: JsonObject;
  overrides: JsonObject;
  course_id: number;
  /** The course's language plugin, whose item schemas validate the data (DR-06). */
  plugin: string;
  related: string[];
}

const ITEM = `SELECT i.id, i.key, i.type, i.level_code, i.source, i.dataset_version, i.data,
    i.overrides, i.course_id, c.plugin,
    array(SELECT t.key FROM item_links l JOIN items t ON t.id = l.to_item_id
          WHERE l.from_item_id = i.id AND l.kind = 'related' ORDER BY t.key)::text[] AS related
  FROM items i JOIN courses c ON c.id = i.course_id`;

export function findItem(db: Queryable, id: number): Promise<AuthoringItemRow | null> {
  return queryOne(db, `${ITEM} WHERE i.id = $1`, [id]);
}

/** As findItem, locked until the transaction ends so an import cannot change `data` meanwhile. */
export function lockItem(db: Queryable, id: number): Promise<AuthoringItemRow | null> {
  return queryOne(db, `${ITEM} WHERE i.id = $1 FOR UPDATE OF i`, [id]);
}

/** FR-222: an authored item's level. */
export async function setItemLevel(db: Queryable, id: number, level: string | null): Promise<void> {
  await query(db, `UPDATE items SET level_code = $2, updated_at = now() WHERE id = $1`, [
    id,
    level,
  ]);
}

/** The course's language plugin, or null when there is no such course. */
export async function findCoursePlugin(db: Queryable, courseId: number): Promise<string | null> {
  const row = await queryOne<{ plugin: string }>(db, `SELECT plugin FROM courses WHERE id = $1`, [
    courseId,
  ]);
  return row?.plugin ?? null;
}

export interface AuthoringItemListRow {
  id: number;
  key: string;
  type: string;
  level_code: string | null;
  source: string | null;
  overridden: boolean;
}

// shortcut: matches the key only and returns the first 50, which is enough to find one item by
// its written form or reading; add meaning search and paging if authors need to browse.
export function listItems(
  db: Queryable,
  courseId: number,
  type: string | null,
  search: string | null,
): Promise<AuthoringItemListRow[]> {
  return query(
    db,
    `SELECT id, key, type, level_code, source, overrides <> '{}'::jsonb AS overridden
       FROM items
      WHERE course_id = $1 AND archived_at IS NULL AND ($2::text IS NULL OR type = $2)
        AND ($3::text IS NULL OR strpos(key, $3) > 0)
      ORDER BY key COLLATE "C"
      LIMIT 50`,
    [courseId, type, search],
  );
}

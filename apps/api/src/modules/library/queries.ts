import type { SentenceAttribution, Tile } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { query, queryOne } from '../../db/db';
import type { ItemLinkKind } from '@manabi/core';
import type { JsonObject } from '../content/rows';

// Hand-written SQL for the library (FR-075, FR-092, FR-102; SDD section 8). Item `data` is read
// merged with `overrides` (DR-09), the same shallow merge the content service applies.

export interface LibraryItemRow {
  id: number;
  key: string;
  type: string;
  level_code: string | null;
  data: JsonObject;
  /** FR-102: the learner's lowest facet stage; null when not started. */
  stage: number | null;
}

const STAGE = `LEFT JOIN LATERAL (
    SELECT min(p.stage)::int AS stage FROM item_progress p
     WHERE p.user_id = $1 AND p.item_id = i.id) s ON true`;
const ITEM = `i.id, i.key, i.type, i.level_code, i.data || i.overrides AS data, s.stage`;

export interface ItemFilters {
  courseId: number;
  userId: number;
  type: string | null;
  level: string | null;
  strokeCount: number | null;
  radical: string | null;
  /** A LIKE pattern over `search_text`, already escaped. */
  pattern: string | null;
  notStarted: boolean;
  /** Inclusive stage range, or null. */
  stages: readonly [number, number] | null;
  afterId: number | null;
  limit: number;
}

export function listItems(db: Queryable, f: ItemFilters): Promise<LibraryItemRow[]> {
  return query<LibraryItemRow>(
    db,
    `SELECT ${ITEM}
       FROM items i ${STAGE}
      WHERE i.course_id = $2 AND i.archived_at IS NULL
        AND ($3::text IS NULL OR i.type = $3)
        AND ($4::text IS NULL OR i.level_code = $4)
        AND ($5::int IS NULL OR i.stroke_count = $5)
        AND ($6::text IS NULL OR i.radical = $6)
        AND ($7::text IS NULL OR i.search_text LIKE $7)
        AND (NOT $8::boolean OR s.stage IS NULL)
        AND ($9::int IS NULL OR s.stage BETWEEN $9 AND $10)
        AND ($11::bigint IS NULL OR i.id > $11)
      ORDER BY i.id
      LIMIT $12`,
    [
      f.userId,
      f.courseId,
      f.type,
      f.level,
      f.strokeCount,
      f.radical,
      f.pattern,
      f.notStarted,
      f.stages?.[0] ?? null,
      f.stages?.[1] ?? null,
      f.afterId,
      f.limit,
    ],
  );
}

export function findItem(
  db: Queryable,
  userId: number,
  key: string,
): Promise<(LibraryItemRow & { course_id: number }) | null> {
  return queryOne(
    db,
    `SELECT ${ITEM}, i.course_id FROM items i ${STAGE} WHERE i.key = $2 AND i.archived_at IS NULL`,
    [userId, key],
  );
}

export function listFacets(
  db: Queryable,
  userId: number,
  itemId: number,
): Promise<{ facet: string; stage: number; due_at: Date | null }[]> {
  return query(
    db,
    `SELECT facet, stage, due_at FROM item_progress
      WHERE user_id = $1 AND item_id = $2 ORDER BY facet`,
    [userId, itemId],
  );
}

export interface LinkRow extends LibraryItemRow {
  kind: ItemLinkKind;
  direction: 'outgoing' | 'incoming';
}

export function listLinks(db: Queryable, userId: number, itemId: number): Promise<LinkRow[]> {
  return query<LinkRow>(
    db,
    `SELECT l.kind, CASE WHEN l.from_item_id = $2 THEN 'outgoing' ELSE 'incoming' END AS direction,
            ${ITEM}
       FROM item_links l
       JOIN items i
         ON i.id = CASE WHEN l.from_item_id = $2 THEN l.to_item_id ELSE l.from_item_id END
       ${STAGE}
      WHERE (l.from_item_id = $2 OR l.to_item_id = $2) AND i.archived_at IS NULL
      ORDER BY l.kind, direction, i.id`,
    [userId, itemId],
  );
}

export interface ExampleSentenceRow {
  id: number;
  text: string;
  translation: string;
  tokens: Tile[];
  attribution: SentenceAttribution | null;
}

/**
 * Up to 5 sentences using the item, a word containing it (a kanji's words) or, for a grammar
 * point, detecting it. Flagged and challenging sentences are left out; reviewed ones come first,
 * then the shortest. "Challenging" is derived as the Tatoeba importer does (FR-236): the grammar
 * level ranks above the vocabulary level by section order, a sentence with no counted words
 * ranking below every level, unless the author overrode it.
 * shortcut: the OR over grammar and sentence_items filters all the course's sentences; split it
 * into two indexed branches if item detail nears NFR-01's 300 ms.
 */
export function listExampleSentences(
  db: Queryable,
  item: { id: number; key: string; course_id: number },
): Promise<ExampleSentenceRow[]> {
  return query<ExampleSentenceRow>(
    db,
    `WITH levels AS (
       SELECT level_code, min(position) AS rank FROM sections
        WHERE course_id = $1 AND archived_at IS NULL
        GROUP BY level_code
     ), uses AS (
       SELECT $2::bigint AS item_id
       UNION SELECT l.from_item_id FROM item_links l JOIN items w ON w.id = l.from_item_id
              WHERE l.to_item_id = $2 AND l.kind = 'contains' AND w.archived_at IS NULL
     )
     SELECT s.id, s.text, s.translation, s.tokens, s.attribution
       FROM sentences s
      WHERE s.course_id = $1 AND s.archived_at IS NULL AND s.review_status <> 'flagged'
        AND (s.grammar ? $3
             OR EXISTS (SELECT 1 FROM sentence_items si JOIN uses u ON u.item_id = si.item_id
                         WHERE si.sentence_id = s.id))
        AND NOT coalesce(s.challenge_override,
              (SELECT rank FROM levels WHERE level_code = s.grammar_level_code)
              > coalesce((SELECT rank FROM levels WHERE level_code = s.vocab_level_code), -1),
              false)
      ORDER BY s.review_status = 'reviewed' DESC, char_length(s.text), s.id
      LIMIT 5`,
    [item.course_id, item.id, item.key],
  );
}

// Library fields (search terms, stroke count, radical) are stored on the item at every write.

export function listItemsForLibraryFields(
  db: Queryable,
  courseId: number,
  keys: readonly string[] | null,
  onlyMissing: boolean,
): Promise<{ id: number; type: string; data: JsonObject }[]> {
  return query(
    db,
    `SELECT id, type, data || overrides AS data FROM items
      WHERE course_id = $1 AND ($2::text[] IS NULL OR key = ANY ($2))
        AND (NOT $3::boolean OR search_text IS NULL)`,
    [courseId, keys, onlyMissing],
  );
}

export async function setLibraryFields(
  db: Queryable,
  rows: readonly {
    id: number;
    searchText: string;
    strokeCount: number | null;
    radical: string | null;
  }[],
): Promise<void> {
  if (rows.length === 0) return;
  await query(
    db,
    `UPDATE items SET search_text = t.search_text, stroke_count = t.stroke_count, radical = t.radical
       FROM unnest($1::bigint[], $2::text[], $3::smallint[], $4::text[])
            AS t (id, search_text, stroke_count, radical)
      WHERE items.id = t.id
        AND (items.search_text, items.stroke_count, items.radical)
            IS DISTINCT FROM (t.search_text, t.stroke_count, t.radical)`,
    [
      rows.map((r) => r.id),
      rows.map((r) => r.searchText),
      rows.map((r) => r.strokeCount),
      rows.map((r) => r.radical),
    ],
  );
}

/** Courses with items whose library fields were never written (existing items at migration). */
export function listCoursesMissingLibraryFields(db: Queryable): Promise<{ id: number }[]> {
  return query(
    db,
    `SELECT id FROM courses c
      WHERE EXISTS (SELECT 1 FROM items i WHERE i.course_id = c.id AND i.search_text IS NULL)`,
  );
}

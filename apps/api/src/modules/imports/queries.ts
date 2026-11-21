import type { Queryable } from '../../db/db';
import { insertReturning, query } from '../../db/db';
import type { JsonObject } from '../content/rows';
import type { SentenceAttribution, Tile } from '@manabi/core';
import type { ImportedItem, LevelledGrammarPoint, LevelWord } from '@manabi/importers';

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

/** FR-077: the course's character items (those whose data has a `character`, such as kana and kanji). */
export function findCharacterItems(
  db: Queryable,
  courseId: number,
): Promise<{ id: number; character: string }[]> {
  return query(
    db,
    `SELECT id, data->>'character' AS character FROM items
     WHERE course_id = $1 AND data ? 'character' ORDER BY id`,
    [courseId],
  );
}

/** Upserts stroke data by item; an unchanged row is not written, so a re-run changes nothing. */
export async function upsertStrokeData(
  db: Queryable,
  rows: { itemId: number; strokes: object }[],
): Promise<UpsertCounts> {
  const [row] = await query<{ added: number; updated: number }>(
    db,
    `WITH upserted AS (
       INSERT INTO stroke_data (item_id, strokes)
       SELECT t.item_id, t.strokes::jsonb
       FROM unnest($1::bigint[], $2::text[]) AS t (item_id, strokes)
       ON CONFLICT (item_id) DO UPDATE SET strokes = EXCLUDED.strokes, updated_at = now()
       WHERE stroke_data.strokes IS DISTINCT FROM EXCLUDED.strokes
       RETURNING xmax = 0 AS inserted)
     SELECT count(*) FILTER (WHERE inserted)::int AS added,
       count(*) FILTER (WHERE NOT inserted)::int AS updated
     FROM upserted`,
    [rows.map((r) => r.itemId), rows.map((r) => JSON.stringify(r.strokes))],
  );
  return row!;
}

/** The ids of the course's items with these keys. */
export function findItemIds(
  db: Queryable,
  i: { courseId: number; keys: string[] },
): Promise<{ key: string; id: number }[]> {
  return query(db, `SELECT key, id FROM items WHERE course_id = $1 AND key = ANY($2::text[])`, [
    i.courseId,
    i.keys,
  ]);
}

export interface ImportedSentence {
  sourceId: string;
  text: string;
  translation: string;
  tokens: Tile[];
  attribution: SentenceAttribution;
  vocabLevel: string | null;
  grammar: string[];
  grammarLevel: string | null;
}

/**
 * FR-236: the course's grammar points (stubs included) with their detection patterns, as an
 * author override leaves them; the pack import validated them against the plugin's schema.
 */
export function listGrammarPoints(
  db: Queryable,
  courseId: number,
): Promise<LevelledGrammarPoint[]> {
  return query(
    db,
    `SELECT key, level_code AS level, COALESCE((data || overrides) -> 'detection', '[]') AS detection
     FROM items WHERE course_id = $1 AND type = 'grammar' AND archived_at IS NULL ORDER BY key`,
    [courseId],
  );
}

/**
 * SDD section 10 step 5: upserts imported sentences by (course, source, source id), new ones
 * unreviewed. DR-11, FR-238: an edited text or translation keeps its value and attribution, and
 * tiles (with the vocabulary level, detected grammar and grammar level) an author has edited or
 * reviewed, or whose text was edited, are kept; `challenge_override` is never written (FR-236); an
 * identical re-run writes nothing. Returns each written row and whether its tiles
 * were written.
 */
export function upsertImportedSentences(
  db: Queryable,
  i: { courseId: number; source: string; sentences: ImportedSentence[] },
): Promise<{ id: number; inserted: boolean; retiled: boolean }[]> {
  const locked = `(s.edited OR s.tokens_edited OR s.review_status = 'reviewed')`;
  return query(
    db,
    `INSERT INTO sentences AS s
       (course_id, source, source_id, text, translation, tokens, attribution, vocab_level_code,
        grammar, grammar_level_code)
     SELECT $1, $2, t.source_id, t.text, t.translation, t.tokens::jsonb, t.attribution::jsonb,
       t.level, t.grammar::jsonb, t.grammar_level
     FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[],
         $9::text[], $10::text[])
       AS t (source_id, text, translation, tokens, attribution, level, grammar, grammar_level)
     ON CONFLICT (course_id, source, source_id) WHERE source IS NOT NULL DO UPDATE SET
       text = CASE WHEN s.edited THEN s.text ELSE EXCLUDED.text END,
       translation = CASE WHEN s.translation_edited THEN s.translation
         ELSE EXCLUDED.translation END,
       attribution = EXCLUDED.attribution
         || CASE WHEN s.edited THEN jsonb_build_object('sentence', s.attribution -> 'sentence')
            ELSE '{}' END
         || CASE WHEN s.translation_edited
            THEN jsonb_build_object('translation', s.attribution -> 'translation') ELSE '{}' END,
       tokens = CASE WHEN ${locked} THEN s.tokens ELSE EXCLUDED.tokens END,
       vocab_level_code = CASE WHEN ${locked} THEN s.vocab_level_code
         ELSE EXCLUDED.vocab_level_code END,
       grammar = CASE WHEN ${locked} THEN s.grammar ELSE EXCLUDED.grammar END,
       grammar_level_code = CASE WHEN ${locked} THEN s.grammar_level_code
         ELSE EXCLUDED.grammar_level_code END,
       updated_at = now()
     WHERE (NOT s.edited AND (s.text, s.attribution -> 'sentence')
             IS DISTINCT FROM (EXCLUDED.text, EXCLUDED.attribution -> 'sentence'))
       OR (NOT s.translation_edited AND (s.translation, s.attribution -> 'translation')
             IS DISTINCT FROM (EXCLUDED.translation, EXCLUDED.attribution -> 'translation'))
       OR s.attribution -> 'otherTranslationIds'
            IS DISTINCT FROM EXCLUDED.attribution -> 'otherTranslationIds'
       OR (NOT ${locked} AND (s.tokens, s.vocab_level_code, s.grammar, s.grammar_level_code)
             IS DISTINCT FROM (EXCLUDED.tokens, EXCLUDED.vocab_level_code, EXCLUDED.grammar,
               EXCLUDED.grammar_level_code))
     RETURNING s.id, xmax = 0 AS inserted, NOT ${locked} AS retiled`,
    [
      i.courseId,
      i.source,
      i.sentences.map((s) => s.sourceId),
      i.sentences.map((s) => s.text),
      i.sentences.map((s) => s.translation),
      i.sentences.map((s) => JSON.stringify(s.tokens)),
      i.sentences.map((s) => JSON.stringify(s.attribution)),
      i.sentences.map((s) => s.vocabLevel),
      i.sentences.map((s) => JSON.stringify(s.grammar)),
      i.sentences.map((s) => s.grammarLevel),
    ],
  );
}

/**
 * FR-237: archives the course's imported sentences with these source ids that no author has
 * touched (unreviewed, text and tiles unedited); reviewed sentences are never archived. Returns
 * how many were archived.
 */
export async function archiveBlockedSentences(
  db: Queryable,
  i: { courseId: number; source: string; sourceIds: string[] },
): Promise<number> {
  const rows = await query(
    db,
    `UPDATE sentences SET archived_at = now(), updated_at = now()
     WHERE course_id = $1 AND source = $2 AND source_id = ANY($3::text[])
       AND review_status = 'unreviewed' AND NOT edited AND NOT tokens_edited
       AND archived_at IS NULL
     RETURNING id`,
    [i.courseId, i.source, i.sourceIds],
  );
  return rows.length;
}

/** Sets each sentence's `sentence_items` to the items its tiles link to. */
export async function replaceSentenceItems(db: Queryable, sentenceIds: number[]): Promise<void> {
  await query(db, `DELETE FROM sentence_items WHERE sentence_id = ANY($1::bigint[])`, [
    sentenceIds,
  ]);
  await query(
    db,
    `INSERT INTO sentence_items (sentence_id, item_id)
     SELECT DISTINCT s.id, (tile ->> 'itemId')::bigint
     FROM sentences s, jsonb_array_elements(s.tokens) AS tile
     WHERE s.id = ANY($1::bigint[]) AND tile ->> 'itemId' IS NOT NULL`,
    [sentenceIds],
  );
}

import type { Queryable } from '../../db/db';
import { insertReturning, query, queryOne } from '../../db/db';
import type {
  CourseRow,
  ItemRow,
  JsonObject,
  LessonRow,
  SectionRow,
  SentenceRow,
  UnitRow,
} from './rows';
import type {
  LessonType,
  PublishStatus,
  ReviewStatus,
  SentenceAttribution,
  Tile,
} from '@manabi/core';

// Hand-written, parameterized SQL for the content tables. Importer and editor queries are
// added by the issues that need them.

export interface NewCourse {
  key: string;
  targetLang: string;
  baseLang: string;
  plugin: string;
  title: string;
}

export async function insertCourse(db: Queryable, c: NewCourse): Promise<CourseRow> {
  return insertReturning<CourseRow>(
    db,
    `INSERT INTO courses (key, target_lang, base_lang, plugin, title)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [c.key, c.targetLang, c.baseLang, c.plugin, c.title],
  );
}

export interface NewItem {
  courseId: number;
  key: string;
  type: string;
  levelCode: string | null;
  data: JsonObject;
  source: string | null;
  datasetVersion: string | null;
}

export async function insertItem(db: Queryable, i: NewItem): Promise<ItemRow> {
  return insertReturning<ItemRow>(
    db,
    `INSERT INTO items (course_id, key, type, level_code, data, source, dataset_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [i.courseId, i.key, i.type, i.levelCode, i.data, i.source, i.datasetVersion],
  );
}

export function findItemByKey(db: Queryable, key: string): Promise<ItemRow | null> {
  return queryOne<ItemRow>(db, `SELECT * FROM items WHERE key = $1`, [key]);
}

/** DR-09: author edits go to `overrides` only; imported `data` is left untouched. */
export function setItemOverrides(
  db: Queryable,
  key: string,
  overrides: JsonObject,
): Promise<ItemRow | null> {
  return queryOne<ItemRow>(
    db,
    `UPDATE items SET overrides = $2, updated_at = now() WHERE key = $1 RETURNING *`,
    [key, overrides],
  );
}

export function listItemsByCourse(db: Queryable, courseId: number): Promise<ItemRow[]> {
  return query<ItemRow>(db, `SELECT * FROM items WHERE course_id = $1 ORDER BY id`, [courseId]);
}

export interface NewSentence {
  courseId: number;
  text: string;
  tokens: Tile[];
  translation: string;
  source: string | null;
  sourceId: string | null;
  attribution: SentenceAttribution | null;
  grammar: string[];
  vocabLevelCode: string | null;
  grammarLevelCode: string | null;
}

export async function insertSentence(db: Queryable, s: NewSentence): Promise<SentenceRow> {
  return insertReturning<SentenceRow>(
    db,
    `INSERT INTO sentences
       (course_id, text, tokens, translation, source, source_id, attribution, grammar,
        vocab_level_code, grammar_level_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      s.courseId,
      s.text,
      JSON.stringify(s.tokens),
      s.translation,
      s.source,
      s.sourceId,
      s.attribution,
      JSON.stringify(s.grammar),
      s.vocabLevelCode,
      s.grammarLevelCode,
    ],
  );
}

// Content pack import and export (FR-227, FR-232, SDD section 4). Rows are upserted by stable key
// so ids, and the progress that references them, survive re-imports (DR-02, DR-03). Nothing here
// touches a progress table.

/** Position checks wait for commit, so an import can reorder and append freely. */
export async function deferPositionChecks(db: Queryable): Promise<void> {
  await query(
    db,
    `SET CONSTRAINTS sections_course_position_key, units_section_position_key,
       lessons_unit_position_key, lesson_items_lesson_position_key DEFERRED`,
  );
}

export async function upsertCourse(
  db: Queryable,
  c: NewCourse & { status: PublishStatus },
): Promise<number> {
  const row = await insertReturning<{ id: number }>(
    db,
    `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (key) DO UPDATE SET target_lang = EXCLUDED.target_lang,
       base_lang = EXCLUDED.base_lang, plugin = EXCLUDED.plugin, title = EXCLUDED.title,
       status = EXCLUDED.status, updated_at = now()
     RETURNING id`,
    [c.key, c.targetLang, c.baseLang, c.plugin, c.title, c.status],
  );
  return row.id;
}

/** Null when the key belongs to another course's section. */
export async function upsertSection(
  db: Queryable,
  s: { courseId: number; key: string; position: number; title: string; levelCode: string },
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    db,
    `INSERT INTO sections (course_id, key, position, title, level_code)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (key) DO UPDATE SET position = EXCLUDED.position, title = EXCLUDED.title,
       level_code = EXCLUDED.level_code, archived_at = NULL, updated_at = now()
     WHERE sections.course_id = EXCLUDED.course_id
     RETURNING id`,
    [s.courseId, s.key, s.position, s.title, s.levelCode],
  );
  return row?.id ?? null;
}

/** Null when the key belongs to another course's unit. */
export async function upsertUnit(
  db: Queryable,
  u: { sectionId: number; key: string; position: number; title: string; status: PublishStatus },
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    db,
    `INSERT INTO units (section_id, key, position, title, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (key) DO UPDATE SET section_id = EXCLUDED.section_id,
       position = EXCLUDED.position, title = EXCLUDED.title, status = EXCLUDED.status,
       archived_at = NULL, updated_at = now()
     WHERE (SELECT course_id FROM sections WHERE id = units.section_id)
         = (SELECT course_id FROM sections WHERE id = EXCLUDED.section_id)
     RETURNING id`,
    [u.sectionId, u.key, u.position, u.title, u.status],
  );
  return row?.id ?? null;
}

/** Null when the key belongs to another course's lesson. */
export async function upsertLesson(
  db: Queryable,
  l: {
    unitId: number;
    key: string;
    position: number;
    type: LessonType;
    title: string;
    status: PublishStatus;
  },
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    db,
    `INSERT INTO lessons (unit_id, key, position, type, title, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (key) DO UPDATE SET unit_id = EXCLUDED.unit_id, position = EXCLUDED.position,
       type = EXCLUDED.type, title = EXCLUDED.title, status = EXCLUDED.status,
       archived_at = NULL, updated_at = now()
     WHERE (SELECT s.course_id FROM units u JOIN sections s ON s.id = u.section_id
            WHERE u.id = lessons.unit_id)
         = (SELECT s.course_id FROM units u JOIN sections s ON s.id = u.section_id
            WHERE u.id = EXCLUDED.unit_id)
     RETURNING id`,
    [l.unitId, l.key, l.position, l.type, l.title, l.status],
  );
  return row?.id ?? null;
}

// Archiving keeps the row (and the progress pointing at it) and moves it after the active rows of
// its parent, so its position slot never blocks the pack's own positions (migration 0001).

export async function archiveSectionsExcept(
  db: Queryable,
  courseId: number,
  keys: string[],
): Promise<void> {
  await query(
    db,
    `WITH gone AS (
       SELECT id, row_number() OVER (ORDER BY position) - 1 AS n
       FROM sections WHERE course_id = $1 AND NOT (key = ANY ($2::text[])))
     UPDATE sections s SET archived_at = coalesce(s.archived_at, now()),
       position = cardinality($2::text[]) + gone.n
     FROM gone WHERE s.id = gone.id`,
    [courseId, keys],
  );
}

export async function archiveUnitsExcept(
  db: Queryable,
  courseId: number,
  keys: string[],
): Promise<void> {
  await query(
    db,
    `WITH gone AS (
       SELECT u.id, u.section_id,
              row_number() OVER (PARTITION BY u.section_id ORDER BY u.position) - 1 AS n
       FROM units u JOIN sections s ON s.id = u.section_id
       WHERE s.course_id = $1 AND NOT (u.key = ANY ($2::text[])))
     UPDATE units u SET archived_at = coalesce(u.archived_at, now()),
       position = gone.n + (SELECT count(*) FROM units a
                            WHERE a.section_id = gone.section_id AND a.key = ANY ($2::text[]))
     FROM gone WHERE u.id = gone.id`,
    [courseId, keys],
  );
}

export async function archiveLessonsExcept(
  db: Queryable,
  courseId: number,
  keys: string[],
): Promise<void> {
  await query(
    db,
    `WITH gone AS (
       SELECT l.id, l.unit_id,
              row_number() OVER (PARTITION BY l.unit_id ORDER BY l.position) - 1 AS n
       FROM lessons l JOIN units u ON u.id = l.unit_id JOIN sections s ON s.id = u.section_id
       WHERE s.course_id = $1 AND NOT (l.key = ANY ($2::text[])))
     UPDATE lessons l SET archived_at = coalesce(l.archived_at, now()),
       position = gone.n + (SELECT count(*) FROM lessons a
                            WHERE a.unit_id = gone.unit_id AND a.key = ANY ($2::text[]))
     FROM gone WHERE l.id = gone.id`,
    [courseId, keys],
  );
}

export async function replaceLessonItems(
  db: Queryable,
  lessonId: number,
  itemIds: number[],
): Promise<void> {
  await query(db, `DELETE FROM lesson_items WHERE lesson_id = $1`, [lessonId]);
  await query(
    db,
    `INSERT INTO lesson_items (lesson_id, item_id, position)
     SELECT $1, item_id, ord - 1 FROM unnest($2::bigint[]) WITH ORDINALITY AS t (item_id, ord)`,
    [lessonId, itemIds],
  );
}

/** An item the pack authors. Null when the key belongs to an imported item or another course. */
export async function upsertAuthoredItem(
  db: Queryable,
  i: {
    courseId: number;
    key: string;
    type: string;
    levelCode: string | null;
    data: JsonObject;
    overrides: JsonObject;
  },
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    db,
    `INSERT INTO items (course_id, key, type, level_code, data, overrides)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (key) DO UPDATE SET type = EXCLUDED.type, level_code = EXCLUDED.level_code,
       data = EXCLUDED.data, overrides = EXCLUDED.overrides, archived_at = NULL,
       updated_at = now()
     WHERE items.course_id = EXCLUDED.course_id AND items.source IS NULL
     RETURNING id`,
    [i.courseId, i.key, i.type, i.levelCode, i.data, i.overrides],
  );
  return row?.id ?? null;
}

/** DR-09: author overrides on a dataset-imported item. Null when there is no such item. */
export function setImportedItemOverrides(
  db: Queryable,
  i: { courseId: number; key: string; type: string; overrides: JsonObject },
): Promise<{ data: JsonObject } | null> {
  return queryOne<{ data: JsonObject }>(
    db,
    `UPDATE items SET overrides = $4, updated_at = now()
     WHERE course_id = $1 AND key = $2 AND type = $3 AND source IS NOT NULL
     RETURNING data`,
    [i.courseId, i.key, i.type, i.overrides],
  );
}

/** Dataset-imported items belong to their importers, so only authored items are archived. */
export async function archiveAuthoredItemsExcept(
  db: Queryable,
  courseId: number,
  keys: string[],
): Promise<void> {
  await query(
    db,
    `UPDATE items SET archived_at = now()
     WHERE course_id = $1 AND source IS NULL AND archived_at IS NULL
       AND NOT (key = ANY ($2::text[]))`,
    [courseId, keys],
  );
}

export function listActiveItemKeys(
  db: Queryable,
  courseId: number,
): Promise<{ id: number; key: string }[]> {
  return query(db, `SELECT id, key FROM items WHERE course_id = $1 AND archived_at IS NULL`, [
    courseId,
  ]);
}

export async function replaceRelatedLinks(
  db: Queryable,
  fromItemId: number,
  toItemIds: number[],
): Promise<void> {
  await query(db, `DELETE FROM item_links WHERE from_item_id = $1 AND kind = 'related'`, [
    fromItemId,
  ]);
  await query(
    db,
    `INSERT INTO item_links (from_item_id, to_item_id, kind)
     SELECT $1, unnest($2::bigint[]), 'related'`,
    [fromItemId, toItemIds],
  );
}

/** Pack sentences are matched by source id when imported, by text when authored. */
export async function findSentenceId(
  db: Queryable,
  courseId: number,
  s: { source: string | null; sourceId: string | null; text: string },
): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    db,
    `SELECT id FROM sentences
     WHERE course_id = $1
       AND CASE WHEN $2::text IS NULL THEN source IS NULL AND text = $4
                ELSE source = $2 AND source_id = $3 END
     ORDER BY id LIMIT 1`,
    [courseId, s.source, s.sourceId, s.text],
  );
  return row?.id ?? null;
}

export interface PackSentenceValues {
  text: string;
  translation: string;
  tokens: Tile[];
  source: string | null;
  sourceId: string | null;
  attribution: SentenceAttribution | null;
  reviewStatus: ReviewStatus;
  grammar: string[];
  vocabLevelCode: string | null;
  grammarLevelCode: string | null;
  challengeOverride: boolean | null;
  edited: boolean;
  translationEdited: boolean;
  tokensEdited: boolean;
}

const sentenceParams = (s: PackSentenceValues) => [
  s.text,
  s.translation,
  JSON.stringify(s.tokens),
  s.source,
  s.sourceId,
  s.attribution,
  s.reviewStatus,
  JSON.stringify(s.grammar),
  s.vocabLevelCode,
  s.grammarLevelCode,
  s.challengeOverride,
  s.edited,
  s.translationEdited,
  s.tokensEdited,
];

export function insertPackSentence(
  db: Queryable,
  courseId: number,
  s: PackSentenceValues,
): Promise<{ id: number; tokens: Tile[] }> {
  return insertReturning(
    db,
    `INSERT INTO sentences
       (text, translation, tokens, source, source_id, attribution, review_status, grammar,
        vocab_level_code, grammar_level_code, challenge_override, edited, translation_edited,
        tokens_edited, course_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id, tokens`,
    [...sentenceParams(s), courseId],
  );
}

/**
 * Tiles an author has edited or reviewed are never overwritten (DR-12, SDD section 4). The
 * edited flags only ever turn on, and a pack change to an imported sentence's text, translation
 * or tiles turns the matching one on (DR-11). SET expressions read the row as it was before.
 */
export function updatePackSentence(
  db: Queryable,
  id: number,
  s: PackSentenceValues,
): Promise<{ id: number; tokens: Tile[] }> {
  return insertReturning(
    db,
    `UPDATE sentences SET text = $1, translation = $2,
       tokens = CASE WHEN tokens_edited OR review_status = 'reviewed' THEN tokens ELSE $3::jsonb END,
       source = $4, source_id = $5, attribution = $6, review_status = $7, grammar = $8,
       vocab_level_code = $9, grammar_level_code = $10, challenge_override = $11,
       edited = edited OR $12 OR (source IS NOT NULL AND text IS DISTINCT FROM $1),
       translation_edited = translation_edited OR $13
         OR (source IS NOT NULL AND translation IS DISTINCT FROM $2),
       tokens_edited = tokens_edited OR $14
         OR (source IS NOT NULL AND review_status <> 'reviewed' AND tokens IS DISTINCT FROM $3),
       archived_at = NULL, updated_at = now()
     WHERE id = $15
     RETURNING id, tokens`,
    [...sentenceParams(s), id],
  );
}

export async function replaceSentenceItems(
  db: Queryable,
  sentenceId: number,
  itemIds: number[],
): Promise<void> {
  await query(db, `DELETE FROM sentence_items WHERE sentence_id = $1`, [sentenceId]);
  await query(
    db,
    `INSERT INTO sentence_items (sentence_id, item_id)
     SELECT DISTINCT $1::bigint, unnest($2::bigint[])`,
    [sentenceId, itemIds],
  );
}

/** Dataset-imported sentences belong to their importer, so only authored ones are archived. */
export async function archiveAuthoredSentencesExcept(
  db: Queryable,
  courseId: number,
  ids: number[],
): Promise<void> {
  await query(
    db,
    `UPDATE sentences SET archived_at = now()
     WHERE course_id = $1 AND source IS NULL AND archived_at IS NULL
       AND NOT (id = ANY ($2::bigint[]))`,
    [courseId, ids],
  );
}

// Export reads active rows only, in path order.

export function findCourseByKey(db: Queryable, key: string): Promise<CourseRow | null> {
  return queryOne<CourseRow>(db, `SELECT * FROM courses WHERE key = $1`, [key]);
}

/** FR-237: a language's blocklist, in word order. */
export async function listBlockedWords(db: Queryable, lang: string): Promise<string[]> {
  const rows = await query<{ word: string }>(
    db,
    `SELECT word FROM blocked_words WHERE lang = $1 ORDER BY word`,
    [lang],
  );
  return rows.map((r) => r.word);
}

/** FR-237: makes a language's blocklist exactly `words`, keeping the rows of words it already has. */
export async function replaceBlockedWords(
  db: Queryable,
  lang: string,
  words: string[],
): Promise<void> {
  await query(db, `DELETE FROM blocked_words WHERE lang = $1 AND NOT word = ANY($2::text[])`, [
    lang,
    words,
  ]);
  await query(
    db,
    `INSERT INTO blocked_words (lang, word) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`,
    [lang, words],
  );
}

export function listActiveSections(db: Queryable, courseId: number): Promise<SectionRow[]> {
  return query<SectionRow>(
    db,
    `SELECT * FROM sections WHERE course_id = $1 AND archived_at IS NULL ORDER BY position`,
    [courseId],
  );
}

export function listActiveUnits(
  db: Queryable,
  courseId: number,
): Promise<(UnitRow & { section_key: string })[]> {
  return query(
    db,
    `SELECT u.*, s.key AS section_key
     FROM units u JOIN sections s ON s.id = u.section_id
     WHERE s.course_id = $1 AND s.archived_at IS NULL AND u.archived_at IS NULL
     ORDER BY s.position, u.position`,
    [courseId],
  );
}

export function listActiveLessons(
  db: Queryable,
  courseId: number,
): Promise<(LessonRow & { item_keys: string[] })[]> {
  return query(
    db,
    `SELECT l.*,
       array(SELECT i.key FROM lesson_items li JOIN items i ON i.id = li.item_id
             WHERE li.lesson_id = l.id ORDER BY li.position)::text[] AS item_keys
     FROM lessons l JOIN units u ON u.id = l.unit_id JOIN sections s ON s.id = u.section_id
     WHERE s.course_id = $1 AND l.archived_at IS NULL
     ORDER BY l.unit_id, l.position`,
    [courseId],
  );
}

/** Authored items, and imported items that carry author overrides, with related keys. */
export function listPackItems(
  db: Queryable,
  courseId: number,
): Promise<(ItemRow & { related: string[] })[]> {
  return query(
    db,
    `SELECT i.*,
       array(SELECT t.key FROM item_links l JOIN items t ON t.id = l.to_item_id
             WHERE l.from_item_id = i.id AND l.kind = 'related' ORDER BY t.key)::text[] AS related
     FROM items i
     WHERE i.course_id = $1 AND i.archived_at IS NULL
       AND (i.source IS NULL OR i.overrides <> '{}'::jsonb)
     ORDER BY i.key`,
    [courseId],
  );
}

/** Authored sentences, and imported ones an author has touched (like items' overrides). */
export function listPackSentences(db: Queryable, courseId: number): Promise<SentenceRow[]> {
  return query<SentenceRow>(
    db,
    `SELECT * FROM sentences
     WHERE course_id = $1 AND archived_at IS NULL
       AND (source IS NULL OR review_status <> 'unreviewed' OR edited OR translation_edited
            OR tokens_edited OR challenge_override IS NOT NULL)
     ORDER BY id`,
    [courseId],
  );
}

// FR-234: the course's supplementary words, from `lists/supplementary-words.yaml`. Nothing
// references their rows, so words dropped from the pack are deleted.

export async function replaceSupplementaryWords(
  db: Queryable,
  courseId: number,
  words: { level: string; written: string; reading: string; note?: string }[],
): Promise<void> {
  const written = words.map((w) => w.written);
  const reading = words.map((w) => w.reading);
  await query(
    db,
    `DELETE FROM supplementary_words WHERE course_id = $1
       AND (written, reading) NOT IN (SELECT * FROM unnest($2::text[], $3::text[]))`,
    [courseId, written, reading],
  );
  await query(
    db,
    `INSERT INTO supplementary_words (course_id, level_code, written, reading, note)
     SELECT $1, t.level, t.written, t.reading, t.note
     FROM unnest($2::text[], $3::text[], $4::text[], $5::text[]) AS t (level, written, reading, note)
     ON CONFLICT (course_id, written, reading) DO UPDATE
       SET level_code = EXCLUDED.level_code, note = EXCLUDED.note
     WHERE (supplementary_words.level_code, supplementary_words.note)
       IS DISTINCT FROM (EXCLUDED.level_code, EXCLUDED.note)`,
    [courseId, words.map((w) => w.level), written, reading, words.map((w) => w.note ?? null)],
  );
}

/** In pack order: easiest level first (`N5` sorts after `N4` as text), then by written form. */
export function listSupplementaryWords(
  db: Queryable,
  courseId: number,
): Promise<{ level: string; written: string; reading: string; note: string | null }[]> {
  return query(
    db,
    `SELECT level_code AS level, written, reading, note FROM supplementary_words
     WHERE course_id = $1 ORDER BY level_code DESC, written COLLATE "C", reading COLLATE "C"`,
    [courseId],
  );
}

/** FR-228: the course's active items with these keys, and whether each has stroke data. */
export function findLintItems(
  db: Queryable,
  courseId: number,
  keys: string[],
): Promise<
  { key: string; type: string; data: JsonObject; overrides: JsonObject; has_strokes: boolean }[]
> {
  return query(
    db,
    `SELECT i.key, i.type, i.data, i.overrides, s.item_id IS NOT NULL AS has_strokes
     FROM items i LEFT JOIN stroke_data s ON s.item_id = i.id
     WHERE i.course_id = $1 AND i.archived_at IS NULL AND i.key = ANY($2::text[])`,
    [courseId, keys],
  );
}

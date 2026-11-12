import type { Queryable } from '../../db/db';
import { insertReturning, query, queryOne } from '../../db/db';
import type { CourseRow, ItemRow, JsonObject, SentenceRow } from './rows';
import type { SentenceAttribution, Tile } from '@manabi/core';

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

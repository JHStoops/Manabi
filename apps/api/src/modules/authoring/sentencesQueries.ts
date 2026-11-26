import type { Tile } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { query, queryOne } from '../../db/db';
import type { SentenceRow } from '../content/rows';

// FR-059, FR-236, FR-238, DR-11: hand-written SQL for the sentence editor.

export type EditorSentenceRow = SentenceRow & {
  plugin: string;
  target_lang: string;
  challenging: boolean;
};

// A level's rank is its first section's position in the course, as in the library (FR-056).
const RANK = (level: string) => `(SELECT min(sc.position) FROM sections sc
    WHERE sc.course_id = s.course_id AND sc.archived_at IS NULL AND sc.level_code = ${level})`;

// FR-236, FR-059: challenging when the grammar level is above the vocabulary level (no vocabulary
// level counts as below every level), unless an author has overridden it.
const CHALLENGING = `coalesce(s.challenge_override,
    ${RANK('s.grammar_level_code')} > coalesce(${RANK('s.vocab_level_code')}, -1), false)`;

const SENTENCE = `SELECT s.*, c.plugin, c.target_lang, ${CHALLENGING} AS challenging
  FROM sentences s JOIN courses c ON c.id = s.course_id`;

export function findSentence(db: Queryable, id: number): Promise<EditorSentenceRow | null> {
  return queryOne(db, `${SENTENCE} WHERE s.id = $1 AND s.archived_at IS NULL`, [id]);
}

/** As findSentence, locked until the transaction ends so an import cannot write it meanwhile. */
export function lockSentence(db: Queryable, id: number): Promise<EditorSentenceRow | null> {
  return queryOne(db, `${SENTENCE} WHERE s.id = $1 AND s.archived_at IS NULL FOR UPDATE OF s`, [
    id,
  ]);
}

// shortcut: the first 50 by id, which is enough to work through a filter; add paging if authors
// need to browse the whole imported set.
export function listSentences(
  db: Queryable,
  f: { courseId: number; status: string | null; grammar: string | null; q: string | null },
): Promise<EditorSentenceRow[]> {
  return query(
    db,
    `${SENTENCE}
      WHERE s.course_id = $1 AND s.archived_at IS NULL
        AND ($2::text IS NULL OR s.review_status = $2)
        AND ($3::text IS NULL OR s.grammar ? $3)
        AND ($4::text IS NULL OR strpos(s.text, $4) > 0 OR strpos(s.translation, $4) > 0)
      ORDER BY s.id
      LIMIT 50`,
    [f.courseId, f.status, f.grammar, f.q],
  );
}

export async function insertAuthoredSentence(
  db: Queryable,
  s: { courseId: number; text: string; translation: string; tokens: Tile[]; grammar: string[] },
): Promise<number> {
  const row = await queryOne<{ id: number }>(
    db,
    `INSERT INTO sentences (course_id, text, translation, tokens, grammar)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [s.courseId, s.text, s.translation, JSON.stringify(s.tokens), JSON.stringify(s.grammar)],
  );
  return row!.id;
}

/** The editor's write: every value is final; the service works out the DR-11 edited flags. */
export async function updateSentence(
  db: Queryable,
  id: number,
  s: {
    text: string;
    translation: string;
    tokens: Tile[];
    grammar: string[];
    reviewStatus: string;
    challengeOverride: boolean | null;
    edited: boolean;
    translationEdited: boolean;
    tokensEdited: boolean;
  },
): Promise<void> {
  await query(
    db,
    `UPDATE sentences SET text = $2, translation = $3, tokens = $4, grammar = $5,
       review_status = $6, challenge_override = $7, edited = $8, translation_edited = $9,
       tokens_edited = $10, updated_at = now()
     WHERE id = $1`,
    [
      id,
      s.text,
      s.translation,
      JSON.stringify(s.tokens),
      JSON.stringify(s.grammar),
      s.reviewStatus,
      s.challengeOverride,
      s.edited,
      s.translationEdited,
      s.tokensEdited,
    ],
  );
}

/**
 * FR-236: recomputes a level whose inputs changed: the vocabulary level is the highest level
 * among the items the tiles link to (`sentence_items`), the grammar level the highest among the
 * detected points; null when there are none.
 */
export async function refreshSentenceLevels(
  db: Queryable,
  id: number,
  changed: { vocab: boolean; grammar: boolean },
): Promise<void> {
  const highest = (levels: string) => `(SELECT lv FROM (${levels}) AS l (lv)
      ORDER BY ${RANK('l.lv')} DESC NULLS LAST LIMIT 1)`;
  await query(
    db,
    `UPDATE sentences s SET
       vocab_level_code = CASE WHEN $2 THEN ${highest(`SELECT i.level_code FROM sentence_items si
           JOIN items i ON i.id = si.item_id WHERE si.sentence_id = s.id`)}
         ELSE s.vocab_level_code END,
       grammar_level_code = CASE WHEN $3 THEN ${highest(`SELECT i.level_code FROM items i
           WHERE i.course_id = s.course_id AND i.type = 'grammar' AND s.grammar ? i.key`)}
         ELSE s.grammar_level_code END
     WHERE s.id = $1`,
    [id, changed.vocab, changed.grammar],
  );
}

import type { Pool } from 'pg';
import { findBlockedWords } from '@manabi/core';
import type {
  AuthoringSentence,
  AuthoringSentenceSummary,
  CreateSentenceRequest,
  Sentence,
  Tile,
  UpdateSentenceRequest,
} from '@manabi/core';
import { segmentSentence } from '@manabi/importers';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import { languagePlugins } from '../../plugins';
import { listBlockedWords, replaceSentenceItems } from '../content/queries';
import { listGrammarPoints } from '../imports/queries';
import { countCourseItems } from './lessonEditorQueries';
import { findCoursePlugin } from './itemsQueries';
import * as q from './sentencesQueries';

// The sentence editor (FR-059, FR-236, FR-237, FR-238, DR-11, Product Spec section 11). Text is
// segmented and its grammar detected on the server by the importers' one segmentation path
// (SDD section 4), so the editor and the Tatoeba import agree.

function toSentence(row: q.EditorSentenceRow): Sentence {
  return {
    id: row.id,
    courseId: row.course_id,
    text: row.text,
    tokens: row.tokens,
    translation: row.translation,
    source: row.source,
    sourceId: row.source_id,
    attribution: row.attribution,
    reviewStatus: row.review_status,
    grammar: row.grammar,
    vocabLevelCode: row.vocab_level_code,
    grammarLevelCode: row.grammar_level_code,
    challengeOverride: row.challenge_override,
    edited: row.edited,
    translationEdited: row.translation_edited,
    tokensEdited: row.tokens_edited,
    archivedAt: row.archived_at?.toISOString() ?? null,
  };
}

/** FR-237: a warning, not an error: blocklist words among the sentence's tiles. */
async function view(db: Queryable, id: number): Promise<AuthoringSentence> {
  const row = (await q.findSentence(db, id))!;
  const blocked = new Set(await listBlockedWords(db, row.target_lang));
  return {
    sentence: toSentence(row),
    challenging: row.challenging,
    blockedWords: findBlockedWords(row.tokens, blocked),
  };
}

/** FR-236, FR-238: the server's tiles and detected grammar points for the text. */
async function segment(db: Queryable, plugin: string, courseId: number, text: string) {
  const points = await listGrammarPoints(db, courseId);
  const { tiles, grammar } = await segmentSentence(languagePlugins.get(plugin), text, points);
  return { tiles: tiles.map(({ counted: _, ...tile }): Tile => tile), grammar };
}

// Text no tile covers: punctuation, symbols and spaces, which are never tiles (DR-12).
const GAP = /^[\p{P}\p{S}\p{Z}\s]*$/u;

/** FR-238: the tiles cover the text in order; what lies between them is only GAP text. */
function checkTiles(text: string, tiles: readonly Tile[]): void {
  const fail = (path: (string | number)[], message: string): never => {
    throw new AppError('validation_failed', 'The tiles do not match the text', [
      { location: 'body', path, message },
    ]);
  };
  let at = 0;
  for (const [i, tile] of tiles.entries()) {
    const found = text.indexOf(tile.surface, at);
    if (found < 0 || !GAP.test(text.slice(at, found))) {
      fail(['tiles', i, 'surface'], 'Not the next word of the text');
    }
    at = found + tile.surface.length;
  }
  if (!GAP.test(text.slice(at))) fail(['tiles'], 'The tiles leave out part of the text');
}

/** Tiles in one key order, since jsonb reorders object keys (compare stored with sent). */
const sameTiles = (a: readonly Tile[], b: readonly Tile[]) =>
  JSON.stringify(
    a.map((t) => [t.surface, t.base, t.reading, t.itemId ?? null, t.pattern ?? false]),
  ) ===
  JSON.stringify(
    b.map((t) => [t.surface, t.base, t.reading, t.itemId ?? null, t.pattern ?? false]),
  );

const linkedIds = (tiles: readonly Tile[]) => [
  ...new Set(tiles.flatMap((t) => (t.itemId ? [t.itemId] : []))),
];

export async function listSentences(
  db: Queryable,
  f: { course: number; status?: string; grammar?: string; q?: string },
): Promise<AuthoringSentenceSummary[]> {
  const rows = await q.listSentences(db, {
    courseId: f.course,
    status: f.status ?? null,
    grammar: f.grammar ?? null,
    q: f.q || null,
  });
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    translation: r.translation,
    reviewStatus: r.review_status,
    grammarLevelCode: r.grammar_level_code,
    challenging: r.challenging,
  }));
}

export async function getSentence(db: Queryable, id: number): Promise<AuthoringSentence> {
  if (!(await q.findSentence(db, id))) throw new AppError('not_found', 'Sentence not found');
  return view(db, id);
}

// shortcut: tiles from segmentation link to no item (the Tatoeba import links them through the
// level lists), so a new or re-segmented sentence has no vocabulary level until the author links
// its words; reuse the import's matching if authors write many sentences by hand.

/** FR-238: a new authored sentence, segmented, with its grammar detected (FR-236). */
export async function createSentence(
  pool: Pool,
  body: CreateSentenceRequest,
): Promise<AuthoringSentence> {
  return withTransaction(pool, async (db) => {
    const plugin = await findCoursePlugin(db, body.course);
    if (!plugin) throw new AppError('not_found', 'Course not found');
    const { tiles, grammar } = await segment(db, plugin, body.course, body.text);
    const id = await q.insertAuthoredSentence(db, {
      courseId: body.course,
      text: body.text,
      translation: body.translation,
      tokens: tiles,
      grammar,
    });
    await replaceSentenceItems(db, id, linkedIds(tiles));
    await q.refreshSentenceLevels(db, id, { vocab: true, grammar: true });
    return view(db, id);
  });
}

/**
 * FR-059, FR-238, DR-11: an author's edit. An imported sentence's edited flags turn on for the
 * parts that change, so re-import keeps them (SDD section 10); they never turn off.
 */
export async function updateSentence(
  pool: Pool,
  id: number,
  body: UpdateSentenceRequest,
): Promise<AuthoringSentence> {
  return withTransaction(pool, async (db) => {
    const row = await q.lockSentence(db, id);
    if (!row) throw new AppError('not_found', 'Sentence not found');
    const text = body.text ?? row.text;
    const translation = body.translation ?? row.translation;
    let tiles = body.tiles ?? row.tokens;
    let grammar = row.grammar;
    // shortcut: a detection or level change on a grammar point re-detects only sentences whose
    // text is saved or that re-import refreshes; re-detect the course if authors tune patterns often.
    if (body.resegment || text !== row.text) {
      const segmented = await segment(db, row.plugin, row.course_id, text);
      grammar = segmented.grammar;
      if (body.resegment) {
        // Keep the item links and pattern marks of tiles that come back unchanged.
        const old = new Map(
          row.tokens.map(({ surface, base, ...rest }) => [`${surface}\0${base}`, rest]),
        );
        tiles = segmented.tiles.map((t) => {
          const { itemId, pattern } = old.get(`${t.surface}\0${t.base}`) ?? {};
          return { ...t, ...(itemId ? { itemId } : {}), ...(pattern ? { pattern } : {}) };
        });
      }
    }
    checkTiles(text, tiles);
    const linked = linkedIds(tiles);
    if ((await countCourseItems(db, row.course_id, linked)) !== linked.length) {
      throw new AppError('validation_failed', 'Unknown item', [
        {
          location: 'body',
          path: ['tiles'],
          message: 'A tile links to an item not in this course',
        },
      ]);
    }
    const imported = row.source !== null;
    const tilesChanged = !sameTiles(tiles, row.tokens);
    await q.updateSentence(db, id, {
      text,
      translation,
      tokens: tiles,
      grammar,
      reviewStatus: body.reviewStatus ?? row.review_status,
      challengeOverride:
        body.challengeOverride === undefined ? row.challenge_override : body.challengeOverride,
      edited: row.edited || (imported && text !== row.text),
      translationEdited: row.translation_edited || (imported && translation !== row.translation),
      tokensEdited: row.tokens_edited || (imported && tilesChanged),
    });
    // FR-236: a level changes only with its inputs, so a reading or pattern fix keeps the
    // vocabulary level the import set.
    const changed = {
      vocab: JSON.stringify(linked) !== JSON.stringify(linkedIds(row.tokens)),
      grammar: JSON.stringify(grammar) !== JSON.stringify(row.grammar),
    };
    if (changed.vocab) await replaceSentenceItems(db, id, linked);
    if (changed.vocab || changed.grammar) await q.refreshSentenceLevels(db, id, changed);
    return view(db, id);
  });
}

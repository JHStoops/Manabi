import { createReadStream } from 'node:fs';
import type { Pool } from 'pg';
import { parseItemData } from '@manabi/core';
import {
  datasets,
  kanaItems,
  kanjiVgToHanziWriter,
  parseJmdict,
  parseKanjidic2,
  parseKanjiVg,
  readLevelLists,
} from '@manabi/importers';
import type { DatasetName, ParsedDataset } from '@manabi/importers';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { languagePlugins } from '../../plugins';
import { findCourseByKey } from '../content/queries';
import {
  findCharacterItems,
  findKeysOwnedElsewhere,
  finishImportRun,
  insertContainsLinks,
  insertImportRun,
  listWantedWords,
  setImportedItemLevels,
  upsertImportedItems,
  upsertLevelListWords,
  upsertStrokeData,
} from './queries';

// Dataset imports (FR-226, SDD section 10): repeatable, keyed by stable key, never writing to
// progress tables or overwriting author overrides.

export interface ImportSummary {
  [key: string]: unknown;
  datasetVersion: string;
  licence: string;
  attribution: string;
  added: number;
  updated: number;
  skipped: number;
}

/** Records an import_runs row around `run`: succeeded with its summary, or failed with the error. */
async function recordRun(
  pool: Pool,
  importer: string,
  run: () => Promise<ImportSummary>,
): Promise<ImportSummary> {
  const id = await insertImportRun(pool, importer);
  try {
    const summary = await run();
    await finishImportRun(pool, id, 'succeeded', summary);
    return summary;
  } catch (err) {
    await finishImportRun(pool, id, 'failed', { error: String(err) });
    throw err;
  }
}

/**
 * Validates parsed items against the course's plugin (DR-06) and upserts them in one
 * transaction, then runs `after` in it. NFR-62: the dataset's licence and attribution go into
 * the run summary, with the keys skipped because an authored item or another course owns them.
 */
async function importItems(
  pool: Pool,
  courseKey: string,
  source: DatasetName,
  parsed: ParsedDataset,
  after?: (db: Queryable, courseId: number) => Promise<object>,
): Promise<ImportSummary> {
  return withTransaction(pool, async (db) => {
    const course = await findCourseByKey(db, courseKey);
    if (!course) throw new Error(`No course ${courseKey}: import its content pack first`);
    const plugin = languagePlugins.get(course.plugin);
    const items = parsed.items.map((item) => ({
      ...item,
      data: parseItemData(plugin, item.type, item.data) as object,
    }));
    const counts = await upsertImportedItems(db, {
      courseId: course.id,
      source,
      datasetVersion: parsed.datasetVersion,
      items,
    });
    const skippedOwned = await findKeysOwnedElsewhere(db, {
      courseId: course.id,
      source,
      keys: items.map((item) => item.key),
    });
    const { licence, attribution } = datasets[source];
    return {
      datasetVersion: parsed.datasetVersion,
      licence,
      attribution,
      ...counts,
      skipped: parsed.items.length - counts.added - counts.updated,
      skippedOwned,
      ...(await after?.(db, course.id)),
    };
  });
}

export interface ImportFile {
  courseKey: string;
  /** Path of the unzipped dataset file (see `npm run download --workspace @manabi/importers`). */
  file: string;
}

/** SDD section 10 step 1: one kanji item per KANJIDIC2 character with an English meaning. */
export function importKanjidic2(
  pool: Pool,
  { courseKey, file }: ImportFile,
): Promise<ImportSummary> {
  return recordRun(pool, 'kanjidic2', async () =>
    importItems(pool, courseKey, 'kanjidic2', await parseKanjidic2(createReadStream(file, 'utf8'))),
  );
}

export interface ImportLevelLists {
  courseKey: string;
  /** The configured level ceiling (`LEVEL_CEILING`); later levels are skipped. */
  ceiling: string;
  /** Lists folder; defaults to the committed copy. */
  dir?: string;
}

/**
 * SDD section 10 step 2, FR-233: sets `level_code` on the course's imported kanji and stores the
 * level-list words, read from the committed copy (no network request) up to the level ceiling.
 * Kanji not imported yet are skipped, so run KANJIDIC2 first.
 */
export function importLevelLists(
  pool: Pool,
  { courseKey, ceiling, dir }: ImportLevelLists,
): Promise<ImportSummary> {
  return recordRun(pool, 'level-lists', async () => {
    const lists = await readLevelLists(ceiling, dir);
    return withTransaction(pool, async (db) => {
      const course = await findCourseByKey(db, courseKey);
      if (!course) throw new Error(`No course ${courseKey}: import its content pack first`);
      const kanji = await setImportedItemLevels(db, { courseId: course.id, levels: lists.kanji });
      const words = await upsertLevelListWords(db, { courseId: course.id, words: lists.words });
      const { datasetVersion, licence, attribution, levels } = lists;
      return {
        datasetVersion,
        licence,
        attribution,
        ceiling,
        levels,
        added: words.added,
        updated: kanji + words.updated,
        skipped: lists.kanji.length + lists.words.length - kanji - words.added - words.updated,
      };
    });
  });
}

/**
 * SDD section 10 step 3: one word item per level-list or supplementary word found in JMdict,
 * with its list level and `contains` links to the course's kanji items. Run it after the
 * level-list import (and KANJIDIC2, for the links); the summary lists the words not found.
 */
export function importJmdict(pool: Pool, { courseKey, file }: ImportFile): Promise<ImportSummary> {
  return recordRun(pool, 'jmdict', async () => {
    const course = await findCourseByKey(pool, courseKey);
    if (!course) throw new Error(`No course ${courseKey}: import its content pack first`);
    const wanted = await listWantedWords(pool, course.id);
    if (wanted.length === 0) {
      throw new Error(`No level-list words for ${courseKey}: run the level-list import first`);
    }
    const parsed = await parseJmdict(createReadStream(file, 'utf8'), wanted);
    return importItems(pool, courseKey, 'jmdict', parsed, async (db, courseId) => {
      await setImportedItemLevels(db, { courseId, levels: parsed.levels });
      const linksAdded = await insertContainsLinks(db, {
        courseId,
        source: 'jmdict',
        links: parsed.links,
      });
      return { linksAdded, unmatched: parsed.unmatched };
    });
  });
}

/**
 * SDD section 10 step 4, FR-077: creates the course's kana items (`ja:kana:<char>`) if missing and,
 * in the same transaction, stores KanjiVG strokes converted to Hanzi Writer data for every
 * character item (kana and kanji). `added`, `updated` and `skipped` count kana items, the
 * `strokes*` fields count stroke rows, and `missing` lists characters KanjiVG lacks. Run KANJIDIC2
 * first so its kanji get strokes.
 */
export function importKanjiVg(pool: Pool, { courseKey, file }: ImportFile): Promise<ImportSummary> {
  return recordRun(pool, 'kanjivg', async () => {
    const { datasetVersion, strokes } = await parseKanjiVg(createReadStream(file, 'utf8'));
    const parsed = { datasetVersion, items: kanaItems() };
    return importItems(pool, courseKey, 'kanjivg', parsed, async (db, courseId) => {
      const rows: { itemId: number; strokes: object }[] = [];
      const missing: string[] = [];
      for (const { id, character } of await findCharacterItems(db, courseId)) {
        const paths = strokes.get(character);
        if (paths) rows.push({ itemId: id, strokes: kanjiVgToHanziWriter(paths) });
        else missing.push(character);
      }
      const counts = await upsertStrokeData(db, rows);
      return {
        strokesAdded: counts.added,
        strokesUpdated: counts.updated,
        strokesSkipped: rows.length - counts.added - counts.updated,
        missing,
      };
    });
  });
}

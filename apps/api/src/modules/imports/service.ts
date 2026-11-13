import { createReadStream } from 'node:fs';
import type { Pool } from 'pg';
import { parseItemData } from '@manabi/core';
import { datasets, parseKanjidic2, readLevelLists } from '@manabi/importers';
import type { DatasetName, ParsedDataset } from '@manabi/importers';
import { withTransaction } from '../../db/db';
import { languagePlugins } from '../../plugins';
import { findCourseByKey } from '../content/queries';
import {
  finishImportRun,
  insertImportRun,
  setImportedItemLevels,
  upsertImportedItems,
  upsertLevelListWords,
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
 * transaction. NFR-62: the dataset's licence and attribution go into the run summary.
 */
async function importItems(
  pool: Pool,
  courseKey: string,
  source: DatasetName,
  parsed: ParsedDataset,
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
    const { licence, attribution } = datasets[source];
    return {
      datasetVersion: parsed.datasetVersion,
      licence,
      attribution,
      ...counts,
      skipped: parsed.items.length - counts.added - counts.updated,
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

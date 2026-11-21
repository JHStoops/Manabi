import { createReadStream } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import type { Pool } from 'pg';
import { parseItemData } from '@manabi/core';
import {
  datasets,
  kanaItems,
  kanjiVgToHanziWriter,
  parseJmdict,
  parseKanjidic2,
  parseKanjiVg,
  parseTatoeba,
  readLevelLists,
  readLevelOrder,
} from '@manabi/importers';
import type { DatasetName, ParsedDataset } from '@manabi/importers';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { languagePlugins } from '../../plugins';
import { findCourseByKey, listBlockedWords } from '../content/queries';
import {
  archiveBlockedSentences,
  findCharacterItems,
  findItemIds,
  findKeysOwnedElsewhere,
  finishImportRun,
  insertContainsLinks,
  insertImportRun,
  listGrammarPoints,
  listWantedWords,
  replaceSentenceItems,
  setImportedItemLevels,
  upsertImportedItems,
  upsertImportedSentences,
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

/**
 * Where `npm run download --workspace @manabi/importers` puts a dataset, relative to the datasets
 * directory: `<name>/<file>` with `.gz` dropped, or the whole folder for Tatoeba's several files.
 */
export function defaultDatasetFile(name: DatasetName): string {
  if (name === 'tatoeba') return name;
  return `${name}/${basename(datasets[name].urls[0]!, '.gz')}`;
}

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/**
 * The absolute path of `file` in the datasets directory. Refuses a path that leaves it, through
 * `..` or a symbolic link. A file that does not exist yet passes; reading it fails the run.
 */
export async function datasetPath(datasetsDir: string, file: string): Promise<string> {
  const root = resolve(datasetsDir);
  const path = resolve(root, file);
  let real: string | null = null;
  try {
    real = await realpath(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  if (!inside(root, path) || (real && !inside(await realpath(root), real))) {
    throw new Error(`${file} is outside the datasets directory`);
  }
  return path;
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

/**
 * SDD section 10 step 5, FR-235, FR-238, DR-11: imports the Tatoeba Japanese-English pairs that
 * pass the sentence filters, unreviewed, with their tiles linked to the course's word items and
 * per-side attribution. `file` is the folder of unpacked exports. Run it after JMdict and the
 * pack import (FR-236: the course's grammar points are detected in each sentence). The summary
 * counts the sentences each filter dropped, the updated ones whose tiles an author owns
 * (`tilesKept`) and the sentences detected as challenging in this run, by grammar level
 * (`challenging`; not the stored status, which keeps locked rows and `challenge_override`).
 * FR-237: sentences with a blocked word are dropped (`dropped.blocked`), and those already
 * imported and untouched by an author are archived (`archivedBlocked`).
 */
export function importTatoeba(pool: Pool, { courseKey, file }: ImportFile): Promise<ImportSummary> {
  return recordRun(pool, 'tatoeba', async () => {
    const course = await findCourseByKey(pool, courseKey);
    if (!course) throw new Error(`No course ${courseKey}: import its content pack first`);
    const wanted = await listWantedWords(pool, course.id);
    if (wanted.length === 0) {
      throw new Error(`No level-list words for ${courseKey}: run the level-list import first`);
    }
    const plugin = languagePlugins.get(course.plugin);
    const points = await listGrammarPoints(pool, course.id);
    const blocked = new Set(await listBlockedWords(pool, course.target_lang));
    const parsed = await parseTatoeba(
      file,
      plugin,
      wanted,
      await readLevelOrder(),
      points,
      blocked,
    );
    const { licence, attribution } = datasets.tatoeba;
    const { datasetVersion } = parsed;
    const part = ({ sourceId, owner }: { sourceId: string; owner: string | null }) => ({
      sourceId,
      owner,
      url: `https://tatoeba.org/en/sentences/show/${sourceId}`,
      licence,
      datasetVersion,
    });
    return withTransaction(pool, async (db) => {
      const keys = parsed.sentences.flatMap((s) => s.tiles.flatMap((t) => t.word ?? []));
      const ids = new Map(
        (await findItemIds(db, { courseId: course.id, keys: [...new Set(keys)] })).map((r) => [
          r.key,
          r.id,
        ]),
      );
      const written = await upsertImportedSentences(db, {
        courseId: course.id,
        source: 'tatoeba',
        sentences: parsed.sentences.map((s) => ({
          sourceId: s.sentence.sourceId,
          text: s.sentence.text,
          translation: s.translation.text,
          tokens: s.tiles.map(({ word, ...tile }) => ({
            ...tile,
            itemId: word ? (ids.get(word) ?? null) : null,
          })),
          attribution: {
            sentence: part(s.sentence),
            translation: part(s.translation),
            otherTranslationIds: s.otherTranslationIds,
          },
          vocabLevel: s.vocabLevel,
          grammar: s.grammar,
          grammarLevel: s.grammarLevel,
        })),
      });
      await replaceSentenceItems(
        db,
        written.filter((r) => r.retiled).map((r) => r.id),
      );
      const archivedBlocked = await archiveBlockedSentences(db, {
        courseId: course.id,
        source: 'tatoeba',
        sourceIds: parsed.blockedIds,
      });
      const added = written.filter((r) => r.inserted).length;
      return {
        datasetVersion,
        licence,
        attribution,
        added,
        updated: written.length - added,
        skipped: parsed.sentences.length - written.length,
        tilesKept: written.filter((r) => !r.retiled).length,
        dropped: parsed.dropped,
        challenging: parsed.challenging,
        archivedBlocked,
      };
    });
  });
}

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * The committed copy of the JLPT level lists (FR-233). Resolved through the package, not
 * `__dirname`, so the API bundle finds it too; the importer never fetches the lists.
 */
export const LEVEL_LISTS_DIR = join(
  dirname(require.resolve('@manabi/importers/package.json')),
  'data/tanos',
);

/** A level-list word, stored for the JMdict importer to filter on (SDD section 10 step 3). */
export interface LevelWord {
  level: string;
  written: string;
  reading: string;
}

export interface LevelLists {
  datasetVersion: string;
  licence: string;
  attribution: string;
  /** The levels read, easiest first: those up to the ceiling that have files. */
  levels: string[];
  /** Kanji item keys with the easiest level that lists them. */
  kanji: { key: string; level: string }[];
  words: LevelWord[];
}

interface Manifest {
  version: string;
  licence: string;
  attribution: string;
  /** FR-244: levels are data, easiest first; only their order matters here. */
  levels: string[];
}

/** A file's non-empty lines, or none when the level is not committed yet. */
async function lines(file: string): Promise<string[] | null> {
  try {
    return (await readFile(file, 'utf8')).split('\n').filter((line) => line.trim() !== '');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * SDD section 10 step 2: reads the level lists in `dir` for every level up to and including
 * `ceiling`; later levels are skipped. An entry listed at two levels keeps the easier one.
 */
export async function readLevelLists(ceiling: string, dir = LEVEL_LISTS_DIR): Promise<LevelLists> {
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as Manifest;
  const last = manifest.levels.indexOf(ceiling);
  if (last < 0) {
    throw new Error(`Level ceiling ${ceiling} is not one of ${manifest.levels.join(', ')}`);
  }
  const result: LevelLists = {
    datasetVersion: manifest.version,
    licence: manifest.licence,
    attribution: manifest.attribution,
    levels: [],
    kanji: [],
    words: [],
  };
  const seen = new Set<string>();
  for (const level of manifest.levels.slice(0, last + 1)) {
    const kanji = await lines(join(dir, `${level}-kanji.txt`));
    const words = await lines(join(dir, `${level}-words.tsv`));
    if (!kanji && !words) continue;
    result.levels.push(level);
    for (const character of kanji ?? []) {
      const key = `ja:kanji:${character.trim()}`;
      if (!seen.has(key)) result.kanji.push({ key, level });
      seen.add(key);
    }
    for (const line of words ?? []) {
      const [written, reading] = line.split('\t').map((field) => field.trim());
      if (!written || !reading) throw new Error(`${level}-words.tsv: bad line "${line}"`);
      const id = `${written}\t${reading}`;
      if (!seen.has(id)) result.words.push({ level, written, reading });
      seen.add(id);
    }
  }
  return result;
}

/** FR-244: the levels named in the lists' manifest, easiest first. */
export async function readLevelOrder(dir = LEVEL_LISTS_DIR): Promise<string[]> {
  return (JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as Manifest).levels;
}

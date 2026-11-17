import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { LanguagePlugin } from '@manabi/core';
import type { LevelWord } from './levelLists';
import { segmentText } from './segmentation';

/** One side of a Tatoeba pair (DR-11). */
export interface TatoebaText {
  sourceId: string;
  text: string;
  /** The contributor's username; null for an ownerless sentence. */
  owner: string | null;
}

export interface TatoebaSentence {
  sentence: TatoebaText;
  /** The lowest-id direct English translation. */
  translation: TatoebaText;
  /** The other direct English translations, for the author to choose from. */
  otherTranslationIds: string[];
  /** Tiles with the level-list word (`ja:word:<written>:<reading>`) each matched, if any. */
  tiles: { surface: string; base: string; reading: string; word: string | null }[];
  /** Highest level among the counted tiles' words; null when no tile is counted. */
  vocabLevel: string | null;
}

export interface ParsedTatoeba {
  datasetVersion: string;
  sentences: TatoebaSentence[];
  /** Sentences dropped by each FR-235 filter, counted under the first one they fail. */
  dropped: {
    noTranslation: number;
    latin: number;
    tooLong: number;
    notNative: number;
    unknownWords: number;
  };
}

const MAX_LENGTH = 15;
const LATIN = /\p{Script=Latin}/u;
// FR-235: only spaces and punctuation are left out of the length; symbols such as ♪ count.
const SPACE_OR_PUNCTUATION = /[\p{P}\p{Z}]/gu;

/** A Tatoeba TSV export's rows, split on tabs. */
async function* rows(file: string): AsyncGenerator<string[]> {
  for await (const line of createInterface({ input: createReadStream(file, 'utf8') })) {
    if (line) yield line.split('\t');
  }
}

// Tatoeba writes \N for an empty field.
const owner = (value: string | undefined): string | null =>
  !value || value === '\\N' ? null : value;

/**
 * FR-235, SDD section 10 step 5: reads the unpacked Tatoeba exports in `dir` (see `datasets.ts`)
 * and keeps a Japanese sentence only if it has a direct English translation, has no Latin
 * letters, is at most 15 characters excluding spaces and punctuation, its owner declares native
 * Japanese (level 5) in the user languages export, and every tile the plugin counts matches a
 * wanted word by its base form, as written or as read. `levels` orders the levels, easiest first.
 */
export async function parseTatoeba(
  dir: string,
  plugin: LanguagePlugin,
  wanted: LevelWord[],
  levels: string[],
): Promise<ParsedTatoeba> {
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as {
    version?: string;
  };
  if (!manifest.version) throw new Error(`Tatoeba: no version in ${dir}/manifest.json`);

  const native = new Set<string>();
  for await (const [lang, level, username] of rows(join(dir, 'user_languages.csv'))) {
    if (lang === 'jpn' && level === '5' && username) native.add(username);
  }
  const links = new Map<string, number[]>();
  for await (const [jpn, eng] of rows(join(dir, 'jpn-eng_links.tsv'))) {
    links.set(jpn!, [...(links.get(jpn!) ?? []), Number(eng)]);
  }
  const linked = new Set([...links.values()].flat().map(String));
  const english = new Map<string, TatoebaText>();
  for await (const [id, , text, user] of rows(join(dir, 'eng_sentences_detailed.tsv'))) {
    if (linked.has(id!) && text) english.set(id!, { sourceId: id!, text, owner: owner(user) });
  }

  // A base form matches a word written that way, or a word read that way.
  const byForm = new Map<string, LevelWord[]>();
  for (const word of wanted) {
    for (const form of new Set([word.written, word.reading])) {
      byForm.set(form, [...(byForm.get(form) ?? []), word]);
    }
  }
  const rank = (word: LevelWord) => levels.indexOf(word.level);

  const result: ParsedTatoeba = {
    datasetVersion: manifest.version,
    sentences: [],
    dropped: { noTranslation: 0, latin: 0, tooLong: 0, notNative: 0, unknownWords: 0 },
  };
  for await (const [id, , text, user] of rows(join(dir, 'jpn_sentences_detailed.tsv'))) {
    if (!id || !text) continue;
    const translations = (links.get(id) ?? [])
      .sort((a, b) => a - b)
      .map((engId) => english.get(String(engId)))
      .filter((t) => t !== undefined);
    const sentenceOwner = owner(user);
    if (translations.length === 0) result.dropped.noTranslation++;
    else if (LATIN.test(text)) result.dropped.latin++;
    else if ([...text.replace(SPACE_OR_PUNCTUATION, '')].length > MAX_LENGTH) {
      result.dropped.tooLong++;
    } else if (!sentenceOwner || !native.has(sentenceOwner)) result.dropped.notNative++;
    else {
      let worst = -1;
      let covered = true;
      const tiles = (await segmentText(plugin, text)).map(({ counted, ...tile }) => {
        if (!counted) return { ...tile, word: null };
        // shortcut: homographs (いる 居る/要る) pick the word whose reading matches the tile, then
        // the easiest; authors fix the rest in the sentence editor (FR-238).
        const [word] = [...(byForm.get(tile.base) ?? [])].sort(
          (a, b) =>
            +(b.reading === tile.reading) - +(a.reading === tile.reading) || rank(a) - rank(b),
        );
        if (!word) covered = false;
        else worst = Math.max(worst, rank(word));
        return { ...tile, word: word ? `ja:word:${word.written}:${word.reading}` : null };
      });
      if (!covered) result.dropped.unknownWords++;
      else {
        const [translation, ...others] = translations;
        result.sentences.push({
          sentence: { sourceId: id, text, owner: sentenceOwner },
          translation: translation!,
          otherTranslationIds: others.map((t) => t.sourceId),
          tiles,
          vocabLevel: worst < 0 ? null : levels[worst]!,
        });
      }
    }
  }
  return result;
}

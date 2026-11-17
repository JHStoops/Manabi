import { SaxesParser } from 'saxes';
import type { WordData } from '@manabi/lang-ja';
import type { ImportedItem, ParsedDataset } from './kanjidic2';
import type { LevelWord } from './levelLists';

export interface ParsedJmdict extends ParsedDataset<WordData> {
  /** Each imported word's key with its list level. */
  levels: { key: string; level: string }[];
  /** Wanted words with no JMdict entry. */
  unmatched: LevelWord[];
  /**
   * Word key and `ja:kanji:<char>` for each distinct character of the written form; the import
   * links only those with a kanji item, so kana never link.
   */
  links: { from: string; to: string }[];
}

interface Entry {
  kebs: { text: string; pri: boolean }[];
  rebs: { text: string; pri: boolean; noKanji: boolean; restr: string[] }[];
  senses: { stagk: string[]; stagr: string[]; pos: string[]; misc: string[]; glosses: string[] }[];
}

/** JMdict's `&uk;` misc entity, as expanded from the DOCTYPE. */
const USUALLY_KANA = 'word usually written using kana alone';

/**
 * FR-226, SDD section 10 step 3: streams JMdict XML (pass `createReadStream(file, 'utf8')`) and
 * returns one word item per wanted level-list word (kana-only words have the reading as their
 * written form) it finds, keyed `ja:word:<written>:<reading>` (DR-02).
 *
 * An entry matches when the written form is one of its kanji spellings and the reading one of the
 * readings allowed with it, or, for a kana-only word, when the reading is one of its readings.
 * Of several matching entries the best is kept: for a kana-only word, one with no kanji spelling
 * or usually written in kana scores 2; a priority-marked (common) spelling or reading scores 1;
 * ties keep the first in the file. The word takes the glosses of the first sense allowed for its
 * spelling and reading, and that sense's parts of speech (a sense without any repeats the last
 * ones given, as JMdict defines).
 */
export async function parseJmdict(
  input: AsyncIterable<string>,
  wanted: LevelWord[],
): Promise<ParsedJmdict> {
  const byForm = new Map<string, LevelWord[]>();
  for (const word of wanted) {
    byForm.set(word.written, [...(byForm.get(word.written) ?? []), word]);
  }
  const best = new Map<string, { score: number; level: string; data: WordData }>();
  const parser = new SaxesParser();
  let datasetVersion = '';
  let text = '';
  let entry: Entry = { kebs: [], rebs: [], senses: [] };

  // JMdict declares its part-of-speech and misc codes as entities in the DOCTYPE.
  parser.on('doctype', (doctype) => {
    for (const [, name, value] of doctype.matchAll(/<!ENTITY\s+(\S+)\s+"([^"]*)">/g)) {
      parser.ENTITIES[name!] = value!;
    }
  });
  parser.on('comment', (comment) => {
    datasetVersion ||= /JMdict created: (\S+)/.exec(comment)?.[1] ?? '';
  });
  parser.on('opentag', ({ name }) => {
    text = '';
    if (name === 'entry') entry = { kebs: [], rebs: [], senses: [] };
    else if (name === 'k_ele') entry.kebs.push({ text: '', pri: false });
    else if (name === 'r_ele') entry.rebs.push({ text: '', pri: false, noKanji: false, restr: [] });
    else if (name === 'sense') {
      entry.senses.push({ stagk: [], stagr: [], pos: [], misc: [], glosses: [] });
    }
  });
  parser.on('text', (chunk) => {
    text += chunk;
  });
  parser.on('closetag', ({ name, attributes }) => {
    const keb = entry.kebs.at(-1);
    const reb = entry.rebs.at(-1);
    const sense = entry.senses.at(-1);
    if (name === 'keb') keb!.text = text;
    else if (name === 'ke_pri') keb!.pri = true;
    else if (name === 'reb') reb!.text = text;
    else if (name === 're_pri') reb!.pri = true;
    else if (name === 're_nokanji') reb!.noKanji = true;
    else if (name === 're_restr') reb!.restr.push(text);
    else if (name === 'stagk') sense!.stagk.push(text);
    else if (name === 'stagr') sense!.stagr.push(text);
    else if (name === 'pos') sense!.pos.push(text);
    else if (name === 'misc') sense!.misc.push(text);
    else if (name === 'gloss' && [undefined, 'eng'].includes(attributes['xml:lang'] as string)) {
      sense!.glosses.push(text);
    } else if (name === 'entry') match(entry);
  });

  function match({ kebs, rebs, senses }: Entry): void {
    // A sense without parts of speech takes the previous sense's.
    senses.forEach((sense, i) => {
      if (sense.pos.length === 0 && i > 0) sense.pos = senses[i - 1]!.pos;
    });
    const forms = new Set([...kebs, ...rebs].map((element) => element.text));
    for (const word of [...forms].flatMap((form) => byForm.get(form) ?? [])) {
      const kanaOnly = word.written === word.reading;
      const keb = kebs.find((k) => k.text === word.written);
      const reb = rebs.find(
        (r) =>
          r.text === word.reading &&
          (kanaOnly || (keb && !r.noKanji && (r.restr.length === 0 || r.restr.includes(keb.text)))),
      );
      if (!reb || (!kanaOnly && !keb)) continue;
      // A kana-only word has no kanji spelling to restrict senses by.
      const sense = senses.find(
        (s) =>
          (kanaOnly || s.stagk.length === 0 || s.stagk.includes(word.written)) &&
          (s.stagr.length === 0 || s.stagr.includes(word.reading)) &&
          s.glosses.length > 0,
      );
      if (!sense) continue;
      const usuallyKana = kebs.length === 0 || senses[0]!.misc.includes(USUALLY_KANA);
      const score = (kanaOnly && usuallyKana ? 2 : 0) + ((keb ?? reb).pri ? 1 : 0);
      const key = `ja:word:${word.written}:${word.reading}`;
      if ((best.get(key)?.score ?? -1) >= score) continue;
      best.set(key, {
        score,
        level: word.level,
        data: {
          written: word.written,
          reading: word.reading,
          meanings: sense.glosses,
          partsOfSpeech: sense.pos,
        },
      });
    }
  }

  for await (const chunk of input) parser.write(chunk);
  parser.close();
  if (!datasetVersion) throw new Error('JMdict: no "JMdict created" date in the header');

  // Keyed by the map, so a word wanted twice is imported once.
  const items: ImportedItem<WordData>[] = [...best].map(([key, { data }]) => ({
    key,
    type: 'word',
    data,
  }));
  return {
    datasetVersion,
    items,
    levels: [...best].map(([key, { level }]) => ({ key, level })),
    unmatched: wanted.filter((w) => !best.has(`ja:word:${w.written}:${w.reading}`)),
    links: items.flatMap(({ key, data }) =>
      [...new Set(data.written)].map((char) => ({ from: key, to: `ja:kanji:${char}` })),
    ),
  };
}

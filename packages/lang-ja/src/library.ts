import type { LibraryFields } from '@manabi/core';
import { toHiragana } from './answer';
import { itemSchemas } from './itemSchemas';

/**
 * FR-075, FR-092: width and case folded, katakana folded to hiragana (so すい finds 水's スイ), and
 * the okurigana dot and affix dash of KANJIDIC2 readings dropped (so たべる finds た.べる).
 */
export const searchKey = (text: string): string =>
  toHiragana(text.normalize('NFKC').toLowerCase()).replace(/[.-]/g, '').trim();

const NONE: LibraryFields = { terms: [], strokeCount: null, radical: null };

export function libraryFields({ type, data }: { type: string; data: unknown }): LibraryFields {
  const fields = (
    terms: string[],
    strokeCount: number | null = null,
    radical: string | null = null,
  ) => ({
    terms: [...new Set(terms.map(searchKey).filter(Boolean))],
    strokeCount,
    radical,
  });
  if (type === 'kana') {
    const kana = itemSchemas.kana.safeParse(data);
    return kana.success ? fields([kana.data.character, kana.data.romaji]) : NONE;
  }
  if (type === 'kanji') {
    const kanji = itemSchemas.kanji.safeParse(data);
    if (!kanji.success) return NONE;
    const k = kanji.data;
    // KANJIDIC2's classical radical is the first component (packages/importers kanjidic2.ts).
    return fields(
      [k.character, ...k.meanings, ...k.onReadings, ...k.kunReadings],
      k.strokeCount,
      k.components[0] ?? null,
    );
  }
  if (type === 'word') {
    const word = itemSchemas.word.safeParse(data);
    if (!word.success) return NONE;
    const w = word.data;
    return fields([w.written, w.reading, ...w.senses.flatMap((s) => s.meanings)]);
  }
  if (type === 'grammar') {
    const grammar = itemSchemas.grammar.safeParse(data);
    if (!grammar.success) return NONE;
    return fields([grammar.data.pattern, ...(grammar.data.meaning ? [grammar.data.meaning] : [])]);
  }
  return NONE;
}

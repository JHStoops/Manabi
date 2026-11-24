import type { Item, TeachingCardFields } from '@manabi/core';
import { KANA_SECTION_LEVEL, effective } from './generators';
import { kanaDataSchema, kanjiDataSchema, wordDataSchema } from './itemSchemas';
import { kanaToRomaji } from './romaji';

/**
 * Product Spec section 4: a kana, kanji or word as its teaching card shows it, with the author's
 * overrides applied. FR-141: romaji only in the kana section.
 */
export function teachingCard(item: Item, sectionLevel: string): TeachingCardFields {
  const romaji = sectionLevel === KANA_SECTION_LEVEL;
  const data = effective(item);
  if (item.type === 'kana') {
    const kana = kanaDataSchema.safeParse(data).data;
    if (kana) return { term: kana.character, reading: romaji ? kana.romaji : null, meaning: null };
  }
  if (item.type === 'kanji') {
    const kanji = kanjiDataSchema.safeParse(data).data;
    if (kanji) {
      const readings = [...kanji.onReadings, ...kanji.kunReadings];
      return {
        term: kanji.character,
        reading: readings.join('、') || null,
        meaning: kanji.meanings.join(', '),
      };
    }
  }
  if (item.type === 'word') {
    const word = wordDataSchema.safeParse(data).data;
    if (word) {
      const readings = [
        word.reading !== word.written ? word.reading : null,
        romaji ? kanaToRomaji(word.reading) : null,
      ].filter((r) => r !== null);
      return {
        term: word.written,
        reading: readings.join(' · ') || null,
        meaning: word.senses.map((s) => s.meanings.join(', ')).join('; '),
      };
    }
  }
  // shortcut: other item types (grammar) and invalid data show only the item key; upgrade when
  // grammar lessons get their explanation-summary card (#59).
  return { term: item.key, reading: null, meaning: null };
}

import type { Item, TeachingCardFields } from '@manabi/core';
import { KANA_SECTION_LEVEL, effective } from './generators';
import { grammarDataSchema, kanaDataSchema, kanjiDataSchema, wordDataSchema } from './itemSchemas';
import { kanaToRomaji } from './romaji';

/**
 * Product Spec sections 4 and 6: a kana, kanji, word or grammar point as its teaching card shows
 * it, with the author's overrides applied. FR-141: romaji only in the kana section.
 */
export function teachingCard(item: Item, sectionLevel: string): TeachingCardFields {
  const romaji = sectionLevel === KANA_SECTION_LEVEL;
  const data = effective(item);
  if (item.type === 'kana') {
    const kana = kanaDataSchema.safeParse(data).data;
    if (kana)
      return {
        term: kana.character,
        reading: romaji ? kana.romaji : null,
        meaning: null,
        spoken: kana.character,
      };
  }
  if (item.type === 'kanji') {
    const kanji = kanjiDataSchema.safeParse(data).data;
    if (kanji) {
      const readings = [...kanji.onReadings, ...kanji.kunReadings];
      return {
        term: kanji.character,
        reading: readings.join('、') || null,
        meaning: kanji.meanings.join(', ') || null,
        // KANJIDIC marks okurigana and affixes with `.` and `-`; they are not spoken.
        spoken:
          kanji.kunReadings[0]?.replace(/[-.]/g, '') || kanji.onReadings[0] || kanji.character,
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
        spoken: word.reading,
      };
    }
  }
  if (item.type === 'grammar') {
    const grammar = grammarDataSchema.safeParse(data).data;
    // A pattern such as "Verb-te + ください" is not speakable; its example sentences are.
    if (grammar)
      return {
        term: grammar.pattern,
        reading: null,
        meaning: grammar.meaning ?? null,
        spoken: '',
        formation: grammar.formation,
      };
  }
  // Invalid data shows only the item key.
  return { term: item.key, reading: null, meaning: null, spoken: item.key };
}

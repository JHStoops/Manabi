import type { Item, TeachingCardFacet, TeachingCardFields } from '@manabi/core';
import { toHiragana } from './answer';
import { KANA_SECTION_LEVEL, effective, readingInWord } from './generators';
import type { KanjiData } from './itemSchemas';
import { grammarDataSchema, kanaDataSchema, kanjiDataSchema, wordDataSchema } from './itemSchemas';
import { kanaToRomaji } from './romaji';

/** KANJIDIC marks okurigana and affixes with `.` and `-`; they are not spoken. */
const unmarked = (reading: string) => reading.replace(/[-.]/g, '');

/**
 * Product Spec section 5: a kanji's main reading, as its reading card shows it: the reading most
 * of the card's words use (KANJIDIC's form of it, so an on reading stays in katakana), else its
 * first on reading, else its first kun reading.
 */
function mainReading(kanji: KanjiData, words: readonly Item[]): string | undefined {
  const own = (reading: string) =>
    [...kanji.onReadings, ...kanji.kunReadings].find(
      (r) => toHiragana(unmarked(r.split('.')[0]!)) === reading,
    );
  const counts = new Map<string, number>();
  for (const word of words) {
    const data = wordDataSchema.safeParse(effective(word)).data;
    const found = data && readingInWord(kanji, data.written, data.reading);
    // A sound change (がく as がっ in 学校) counts as the reading it comes from.
    const base =
      found && !own(found) && found.endsWith('っ')
        ? [...'くつちき'].map((c) => found.slice(0, -1) + c).find((r) => own(r))
        : found;
    if (base) counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  // The first most used, in the card's word order.
  const used = [...counts].reduce<[string, number] | undefined>(
    (best, entry) => (!best || entry[1] > best[1] ? entry : best),
    undefined,
  )?.[0];
  if (!used) return kanji.onReadings[0] ?? kanji.kunReadings[0];
  return own(used) ?? used;
}

/**
 * Product Spec sections 4 and 6: a kana, kanji, word or grammar point as its teaching card shows
 * it, with the author's overrides applied. FR-141: romaji only in the kana section. Product Spec
 * section 5: a kanji's `meaning` card shows its meaning only, and its `reading` card its main
 * reading only; other items ignore the facet.
 */
export function teachingCard(
  item: Item,
  sectionLevel: string,
  card: { facet?: TeachingCardFacet | null; words?: readonly Item[] } = {},
): TeachingCardFields {
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
    if (kanji && card.facet === 'meaning') {
      // The reading is taught on the reading card, so the meaning card does not speak it.
      const meaning = kanji.meanings.join(', ') || null;
      return { term: kanji.character, reading: null, meaning, spoken: '' };
    }
    if (kanji && card.facet === 'reading') {
      const main = mainReading(kanji, card.words ?? []);
      return {
        term: kanji.character,
        reading: main ?? null,
        meaning: null,
        spoken: main ? toHiragana(unmarked(main)) : kanji.character,
      };
    }
    if (kanji) {
      const readings = [...kanji.onReadings, ...kanji.kunReadings];
      return {
        term: kanji.character,
        reading: readings.join('、') || null,
        meaning: kanji.meanings.join(', ') || null,
        spoken:
          (kanji.kunReadings[0] && unmarked(kanji.kunReadings[0])) ||
          kanji.onReadings[0] ||
          kanji.character,
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

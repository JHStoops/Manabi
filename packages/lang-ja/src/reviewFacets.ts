import {
  CHOICE_TYPE,
  FILL_BLANK_TYPE,
  READING_IN_CONTEXT_TYPE,
  REORDER_TYPE,
  TYPED_ANSWER_TYPE,
} from '@manabi/core';
import type { ChoicePayload, LanguagePlugin, TypedAnswerPayload } from '@manabi/core';
import { KANA_ONLY } from './generators';
import { wordDataSchema } from './itemSchemas';

// FR-110, Product Spec section 7: review facets per item type, each with its exercise types.
// shortcut: word listening waits for EX-07/EX-08 (#67), which adds its facet here. The API
// backfills item_progress for new facets at start (#225: word reading).
const FACETS: Record<string, Record<string, readonly string[]>> = {
  kana: { reading: [CHOICE_TYPE, TYPED_ANSWER_TYPE] },
  // #53: meaning by EX-01 or EX-04 (typed_answer asks a kanji's meaning unless the facet is reading).
  kanji: { meaning: [CHOICE_TYPE, TYPED_ANSWER_TYPE], reading: [READING_IN_CONTEXT_TYPE] },
  // #225: reading by EX-04 typed in kana (typed_answer asks a word's reading when the facet is reading).
  word: { meaning: [CHOICE_TYPE, TYPED_ANSWER_TYPE], reading: [TYPED_ANSWER_TYPE] },
  grammar: { usage: [FILL_BLANK_TYPE, REORDER_TYPE] },
};

/**
 * FR-110: the facets of an item type, or of one item. A word written only in kana has no reading
 * facet (#225): its reading is what it shows, so a reading question would answer itself.
 */
export const reviewFacets: LanguagePlugin['reviewFacets'] = (itemType, item) => {
  const facets = Object.hasOwn(FACETS, itemType) ? FACETS[itemType]! : {};
  if (itemType !== 'word' || !item) return facets;
  const word = wordDataSchema.safeParse({ ...item.data, ...item.overrides }).data;
  if (!word || !KANA_ONLY.test(word.written)) return facets;
  return Object.fromEntries(Object.entries(facets).filter(([facet]) => facet !== 'reading'));
};

/**
 * A stored exercise reviews a kanji's meaning only when it plainly asks for it: a typed answer in
 * English, or a choice among items (generated meaning choices name their options' items; an
 * authored choice of readings does not). A word's typed answer reviews its reading when its
 * first (original) answer spells, in kana tiles, a word written with kanji, as the reading
 * exercise does; any other typed answer reviews its meaning (#225). Answers added from reports
 * come after the first, so they never move an exercise between facets. Other facets take any
 * exercise of their types.
 */
export const testsFacet: NonNullable<LanguagePlugin['testsFacet']> = (
  exercise,
  itemType,
  facet,
) => {
  if (itemType === 'word' && exercise.type === TYPED_ANSWER_TYPE) {
    const { answerLanguage, accept } = exercise.payload as TypedAnswerPayload;
    const tiles = accept[0]?.tiles ?? [];
    const asksReading =
      answerLanguage === 'target' &&
      tiles.length > 0 &&
      tiles.every((t) => KANA_ONLY.test(t.surface)) &&
      tiles.some((t) => !KANA_ONLY.test(t.base));
    return (facet === 'reading') === asksReading;
  }
  if (itemType !== 'kanji' || facet !== 'meaning') return true;
  if (exercise.type === TYPED_ANSWER_TYPE) {
    return (exercise.payload as TypedAnswerPayload).answerLanguage === 'base';
  }
  if (exercise.type === CHOICE_TYPE) {
    return (exercise.payload as ChoicePayload).options.every((o) => typeof o.itemId === 'number');
  }
  return true;
};

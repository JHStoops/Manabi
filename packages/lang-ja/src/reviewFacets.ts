import {
  CHOICE_TYPE,
  FILL_BLANK_TYPE,
  READING_IN_CONTEXT_TYPE,
  REORDER_TYPE,
  TYPED_ANSWER_TYPE,
} from '@manabi/core';
import type { ChoicePayload, LanguagePlugin, TypedAnswerPayload } from '@manabi/core';

// FR-110, Product Spec section 7: review facets per item type, each with its exercise types.
// shortcut: word reading waits for a reading exercise (#225), and word listening for EX-07/EX-08
// (#67); each issue adds its facet here. The API backfills item_progress for new facets at start.
const FACETS: Record<string, Record<string, readonly string[]>> = {
  kana: { reading: [CHOICE_TYPE, TYPED_ANSWER_TYPE] },
  // #53: meaning by EX-01 or EX-04 (typed_answer asks a kanji's meaning unless the facet is reading).
  kanji: { meaning: [CHOICE_TYPE, TYPED_ANSWER_TYPE], reading: [READING_IN_CONTEXT_TYPE] },
  word: { meaning: [CHOICE_TYPE, TYPED_ANSWER_TYPE] },
  grammar: { usage: [FILL_BLANK_TYPE, REORDER_TYPE] },
};

export const reviewFacets: LanguagePlugin['reviewFacets'] = (itemType) =>
  Object.hasOwn(FACETS, itemType) ? FACETS[itemType]! : {};

/**
 * A stored exercise reviews a kanji's meaning only when it plainly asks for it: a typed answer in
 * English, or a choice among items (generated meaning choices name their options' items; an
 * authored choice of readings does not). Other facets take any exercise of their types.
 */
export const testsFacet: NonNullable<LanguagePlugin['testsFacet']> = (
  exercise,
  itemType,
  facet,
) => {
  if (itemType !== 'kanji' || facet !== 'meaning') return true;
  if (exercise.type === TYPED_ANSWER_TYPE) {
    return (exercise.payload as TypedAnswerPayload).answerLanguage === 'base';
  }
  if (exercise.type === CHOICE_TYPE) {
    return (exercise.payload as ChoicePayload).options.every((o) => typeof o.itemId === 'number');
  }
  return true;
};

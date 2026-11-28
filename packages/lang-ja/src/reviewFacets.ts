import {
  CHOICE_TYPE,
  FILL_BLANK_TYPE,
  READING_IN_CONTEXT_TYPE,
  REORDER_TYPE,
  TYPED_ANSWER_TYPE,
} from '@manabi/core';
import type { ChoicePayload, LanguagePlugin, TypedAnswerPayload } from '@manabi/core';

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

export const reviewFacets: LanguagePlugin['reviewFacets'] = (itemType) =>
  Object.hasOwn(FACETS, itemType) ? FACETS[itemType]! : {};

const KANA_ONLY = /^[ぁ-ゟ゠-ヿ]+$/u;

/**
 * A stored exercise reviews a kanji's meaning only when it plainly asks for it: a typed answer in
 * English, or a choice among items (generated meaning choices name their options' items; an
 * authored choice of readings does not). A word's typed answer in Japanese reviews its reading
 * when every accepted answer is kana only, and its meaning otherwise (#225). Other facets take
 * any exercise of their types.
 */
export const testsFacet: NonNullable<LanguagePlugin['testsFacet']> = (
  exercise,
  itemType,
  facet,
) => {
  if (itemType === 'word' && exercise.type === TYPED_ANSWER_TYPE) {
    const { answerLanguage, accept } = exercise.payload as TypedAnswerPayload;
    if (answerLanguage !== 'target') return facet === 'meaning';
    return (facet === 'reading') === accept.every((a) => KANA_ONLY.test(a.text));
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

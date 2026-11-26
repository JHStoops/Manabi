import {
  CHOICE_TYPE,
  FILL_BLANK_TYPE,
  READING_IN_CONTEXT_TYPE,
  REORDER_TYPE,
  TYPED_ANSWER_TYPE,
} from '@manabi/core';
import type { LanguagePlugin } from '@manabi/core';

// FR-110, Product Spec section 7: review facets per item type, each with its exercise types.
// shortcut: kanji meaning waits for its exercises (#53), word reading for a reading exercise, and
// word listening for EX-07/EX-08 (#67); each issue adds its facet here and backfills item_progress.
const FACETS: Record<string, Record<string, readonly string[]>> = {
  kana: { reading: [CHOICE_TYPE, TYPED_ANSWER_TYPE] },
  kanji: { reading: [READING_IN_CONTEXT_TYPE] },
  word: { meaning: [CHOICE_TYPE, TYPED_ANSWER_TYPE] },
  grammar: { usage: [FILL_BLANK_TYPE, REORDER_TYPE] },
};

export const reviewFacets: LanguagePlugin['reviewFacets'] = (itemType) =>
  Object.hasOwn(FACETS, itemType) ? FACETS[itemType]! : {};

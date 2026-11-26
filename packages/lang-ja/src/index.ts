import type { LanguagePlugin } from '@manabi/core';
import { annotate } from './annotate';
import { checkAnswer, normalizeAnswer } from './answer';
import { convertInput } from './convertInput';
import { detectGrammar } from './grammar';
import { generators } from './generators';
import { itemSchemas } from './itemSchemas';
import { libraryFields, searchKey } from './library';
import { reviewFacets } from './reviewFacets';
import { segment } from './segment';
import { teachingCard } from './teachingCard';
import { readingOf, tokenize } from './tokenize';

export { annotate } from './annotate';
export { checkAnswer, normalizeAnswer } from './answer';
export { convertInput } from './convertInput';
export { detectGrammar } from './grammar';
export * from './itemSchemas';
export { courseKana } from './kana';
export { libraryFields, searchKey } from './library';
export { reviewFacets } from './reviewFacets';
export { segment } from './segment';
export { readingOf, splitByScript, tokenize } from './tokenize';

/** The Japanese language plugin (SDD section 4, FR-240). */
export const japanese: LanguagePlugin = {
  code: 'ja',
  name: 'Japanese',
  scripts: [
    { id: 'hiragana', readingsAbove: false },
    { id: 'katakana', readingsAbove: false },
    { id: 'kanji', readingsAbove: true },
  ],
  // FR-241: Japanese has kanji study, stroke drawing, furigana and romaji-to-kana input.
  features: {
    characterStudy: true,
    strokeDrawing: true,
    readingAnnotations: true,
    inputConversion: true,
  },
  itemSchemas,
  normalizeAnswer,
  checkAnswer,
  convertInput,
  tokenize,
  annotate,
  teachingCard,
  // Kana and vocabulary generators (#30), EX-09 (#50) and EX-10 (#219); the other kanji ones join with #53.
  generators,
  reviewFacets,
  libraryFields,
  searchKey,
  // FR-136, TTS spike: Kokoro misreads kanji, so it is always sent the kana reading.
  ttsVoice: {
    provider: 'kokoro',
    voice: 'jf_alpha',
    providerLanguage: 'j',
    locale: 'ja-JP',
    input: 'reading',
  },
  readingOf,
  // FR-238: kuromoji 0.1.2 with its IPADIC dictionary, run by the adapter in packages/importers.
  analyzer: 'kuromoji-ipadic',
  segment,
  detectGrammar,
};

export default japanese;

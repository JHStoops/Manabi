import type { LanguagePlugin } from '@manabi/core';
import { checkAnswer, normalizeAnswer } from './answer';
import { detectGrammar } from './grammar';
import { itemSchemas } from './itemSchemas';
import { segment } from './segment';
import { readingOf, tokenize } from './tokenize';

export { checkAnswer, normalizeAnswer } from './answer';
export { detectGrammar } from './grammar';
export * from './itemSchemas';
export { courseKana } from './kana';
export { segment } from './segment';
export { readingOf, splitByScript, tokenize } from './tokenize';

/** Thrown by plugin members whose behavior lands in a later issue. */
export class NotImplementedError extends Error {
  constructor(
    readonly member: string,
    readonly issue: number,
  ) {
    super(`lang-ja: ${member} not implemented (#${issue})`);
    this.name = 'NotImplementedError';
  }
}

// STUB: each member using this throws until its issue implements it; none returns a fake result.
function notImplemented(member: string, issue: number): never {
  throw new NotImplementedError(member, issue);
}

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
  convertInput: () => notImplemented('convertInput', 28),
  tokenize,
  annotate: () => notImplemented('annotate', 57),
  // Generators are added by #30 (kana and vocabulary) and #53 (kanji).
  generators: {},
  reviewFacets: () => notImplemented('reviewFacets', 48),
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

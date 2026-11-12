import type { LanguagePlugin } from '@manabi/core';
import { itemSchemas } from './itemSchemas';
import { readingOf, tokenize } from './tokenize';

export * from './itemSchemas';
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
  normalizeAnswer: () => notImplemented('normalizeAnswer', 27),
  checkAnswer: () => notImplemented('checkAnswer', 27),
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
  segment: () => notImplemented('segment', 109),
  detectGrammar: () => notImplemented('detectGrammar', 110),
};

export default japanese;

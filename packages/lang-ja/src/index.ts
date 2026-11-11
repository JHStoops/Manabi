import type { LanguagePlugin } from '@manabi/core';

// STUB: every behavioral method throws until the Japanese plugin is implemented.
function notImplemented(method: string): never {
  throw new Error(`lang-ja: ${method} not implemented`);
}

export const japanese: LanguagePlugin = {
  code: 'ja',
  name: 'Japanese',
  scripts: ['hiragana', 'katakana', 'kanji'],
  features: {
    characterStudy: false,
    strokeDrawing: false,
    readingAnnotations: false,
    inputConversion: false,
  },
  itemSchemas: {},
  normalizeAnswer: () => notImplemented('normalizeAnswer'),
  checkAnswer: () => notImplemented('checkAnswer'),
  convertInput: () => notImplemented('convertInput'),
  tokenize: () => notImplemented('tokenize'),
  annotate: () => notImplemented('annotate'),
  generators: {},
  reviewFacets: () => notImplemented('reviewFacets'),
  ttsVoice: { locale: 'ja-JP' },
};

export default japanese;

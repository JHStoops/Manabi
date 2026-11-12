import type { Exercise } from '@manabi/core';
import { UnknownLanguagePluginError, createLanguagePluginRegistry } from '@manabi/core';
import japanese, { NotImplementedError } from './index';

const exercise: Exercise = {
  id: 'ex-1',
  type: 'translate',
  prompt: '日本語',
  accepted: ['にほんご'],
};

describe('japanese language plugin', () => {
  it('identifies itself as Japanese with its writing systems', () => {
    expect(japanese.code).toBe('ja');
    expect(japanese.name).toBe('Japanese');
    expect(japanese.scripts).toEqual([
      { id: 'hiragana', readingsAbove: false },
      { id: 'katakana', readingsAbove: false },
      { id: 'kanji', readingsAbove: true },
    ]);
  });

  it('enables every optional feature (FR-241)', () => {
    expect(japanese.features).toEqual({
      characterStudy: true,
      strokeDrawing: true,
      readingAnnotations: true,
      inputConversion: true,
    });
  });

  it('sends Kokoro jf_alpha the kana reading (FR-136)', () => {
    expect(japanese.ttsVoice).toEqual({
      provider: 'kokoro',
      voice: 'jf_alpha',
      providerLanguage: 'j',
      locale: 'ja-JP',
      input: 'reading',
    });
  });

  it('declares the kuromoji-ipadic analyzer (FR-238)', () => {
    expect(japanese.analyzer).toBe('kuromoji-ipadic');
  });

  it('has no generators yet', () => {
    expect(japanese.generators).toEqual({});
  });

  // Each stubbed member must throw instead of returning a fake result.
  it.each<[string, number, () => unknown]>([
    ['normalizeAnswer', 27, () => japanese.normalizeAnswer('にほんご', { exercise })],
    ['checkAnswer', 27, () => japanese.checkAnswer('にほんご', exercise)],
    ['convertInput', 28, () => japanese.convertInput('nihongo', 'romaji')],
    ['annotate', 57, () => japanese.annotate('日本語', [])],
    ['reviewFacets', 48, () => japanese.reviewFacets('word')],
    ['segment', 109, () => japanese.segment([])],
    ['detectGrammar', 110, () => japanese.detectGrammar([], [])],
  ])('throws from stubbed %s', (member, issue, call) => {
    expect(call).toThrow(NotImplementedError);
    expect(call).toThrow(`lang-ja: ${member} not implemented (#${issue})`);
  });
});

describe('plugin registry with lang-ja', () => {
  const registry = createLanguagePluginRegistry([japanese]);

  it('returns lang-ja for "ja" and for a course naming it', () => {
    expect(registry.get('ja')).toBe(japanese);
    expect(registry.forCourse({ plugin: 'ja' })).toBe(japanese);
  });

  it('throws a typed error for an unknown code', () => {
    expect(() => registry.get('zh')).toThrow(UnknownLanguagePluginError);
  });
});

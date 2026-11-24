import { UnknownLanguagePluginError, createLanguagePluginRegistry } from '@manabi/core';
import { checkAnswer, normalizeAnswer } from './answer';
import japanese, { NotImplementedError } from './index';

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

  it('checks answers with the answer module (FR-143)', () => {
    expect(japanese.normalizeAnswer).toBe(normalizeAnswer);
    expect(japanese.checkAnswer).toBe(checkAnswer);
  });

  it('generates choice, match pairs, word bank and typed answer exercises (FR-049)', () => {
    expect(Object.keys(japanese.generators).sort()).toEqual([
      'choice',
      'match_pairs',
      'typed_answer',
      'word_bank',
    ]);
  });

  // Each stubbed member must throw instead of returning a fake result.
  it.each<[string, number, () => unknown]>([
    [
      'annotate',
      57,
      () => japanese.annotate([{ surface: '日本語', base: '日本語', reading: 'にほんご' }], []),
    ],
    ['reviewFacets', 48, () => japanese.reviewFacets('word')],
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

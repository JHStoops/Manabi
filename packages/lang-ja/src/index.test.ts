import type { Exercise } from '@manabi/core';
import japanese from './index';

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
    expect(japanese.scripts).toEqual(['hiragana', 'katakana', 'kanji']);
    expect(japanese.ttsVoice.locale).toBe('ja-JP');
  });

  it('declares no optional features while its behavior is stubbed', () => {
    expect(Object.values(japanese.features).every((enabled) => !enabled)).toBe(true);
    expect(japanese.itemSchemas).toEqual({});
    expect(japanese.generators).toEqual({});
  });

  // Each stubbed method must throw instead of returning a fake result.
  it.each<[string, () => unknown]>([
    ['normalizeAnswer', () => japanese.normalizeAnswer('にほんご', { exercise })],
    ['checkAnswer', () => japanese.checkAnswer('にほんご', exercise)],
    ['convertInput', () => japanese.convertInput('nihongo', 'romaji')],
    ['tokenize', () => japanese.tokenize('日本語')],
    ['annotate', () => japanese.annotate('日本語', [])],
    ['reviewFacets', () => japanese.reviewFacets('word')],
  ])('throws from stubbed %s', (method, call) => {
    expect(call).toThrow(`lang-ja: ${method} not implemented`);
  });
});

import japanese from './index';

describe('japanese language plugin', () => {
  it('identifies itself as Japanese with its writing systems', () => {
    expect(japanese.code).toBe('ja');
    expect(japanese.scripts).toEqual(['hiragana', 'katakana', 'kanji']);
    expect(japanese.ttsVoice.locale).toBe('ja-JP');
  });

  it('throws from stubbed methods instead of returning fake results', () => {
    expect(() => japanese.tokenize('日本語')).toThrow('lang-ja: tokenize not implemented');
  });
});

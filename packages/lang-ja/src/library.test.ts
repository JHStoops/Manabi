import { libraryFields, searchKey } from './library';

describe('searchKey', () => {
  it('folds width, case, katakana and reading punctuation', () => {
    expect(searchKey(' ＷＡＴＥＲ ')).toBe('water');
    expect(searchKey('スイ')).toBe('すい');
    expect(searchKey('た.べる')).toBe('たべる');
    expect(searchKey('-か')).toBe('か');
  });
});

describe('libraryFields', () => {
  it('gives a kanji its terms, stroke count and radical', () => {
    expect(
      libraryFields({
        type: 'kanji',
        data: {
          character: '語',
          meanings: ['Language'],
          onReadings: ['ゴ'],
          kunReadings: ['かた.る'],
          strokeCount: 14,
          components: ['言'],
        },
      }),
    ).toEqual({ terms: ['語', 'language', 'ご', 'かたる'], strokeCount: 14, radical: '言' });
  });

  it('gives words, kana and grammar their terms without filters', () => {
    expect(
      libraryFields({
        type: 'word',
        data: { written: '水', reading: 'みず', senses: [{ meanings: ['water'] }] },
      }).terms,
    ).toEqual(['水', 'みず', 'water']);
    expect(
      libraryFields({ type: 'kana', data: { character: 'ア', script: 'katakana', romaji: 'a' } }),
    ).toEqual({ terms: ['あ', 'a'], strokeCount: null, radical: null });
    expect(
      libraryFields({ type: 'grammar', data: { pattern: 'てください', meaning: 'please do' } })
        .terms,
    ).toEqual(['てください', 'please do']);
  });

  it('gives invalid data and unknown types no terms', () => {
    expect(libraryFields({ type: 'kanji', data: { character: '水' } }).terms).toEqual([]);
    expect(libraryFields({ type: 'radical', data: {} }).terms).toEqual([]);
  });
});

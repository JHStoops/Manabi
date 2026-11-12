import type { Tile } from '@manabi/core';
import { tileSchema } from '@manabi/core';
import japanese from './index';
import { readingOf, splitByScript, tokenize } from './tokenize';

const stored: Tile[] = [
  { surface: '私', base: '私', reading: 'わたし', itemId: 42 },
  { surface: 'は', base: 'は', reading: 'は' },
  { surface: '水を', base: '水', reading: 'みずを', itemId: null },
  { surface: '飲みました', base: '飲む', reading: 'のみました' },
];

describe('tokenize', () => {
  it('is the plugin member', () => {
    expect(japanese.tokenize).toBe(tokenize);
  });

  it('returns stored tiles unchanged, even when they differ from a script split', () => {
    const result = tokenize({ text: '私は水を飲みました。', tiles: stored });
    expect(result).toEqual(stored);
    result.forEach((tile, i) => expect(tile).toBe(stored[i]));
  });

  it('returns a new array, so callers cannot change the stored tiles', () => {
    const result = tokenize({ text: '私は', tiles: stored });
    expect(result).not.toBe(stored);
  });

  it.each<[string, Tile[] | null | undefined]>([
    ['absent', undefined],
    ['null', null],
    ['empty', []],
  ])('falls back to a script split when stored tiles are %s', (_label, tiles) => {
    expect(tokenize({ text: '水を飲む', tiles }).map((t) => t.surface)).toEqual([
      '水',
      'を',
      '飲',
      'む',
    ]);
  });
});

describe('splitByScript', () => {
  it.each<[string, string, string[]]>([
    ['kanji then hiragana', '私は学生です', ['私', 'は', '学生', 'です']],
    ['katakana runs', 'コーヒーをください', ['コーヒー', 'をください']],
    ['a prolonged mark after hiragana', 'らーめん', ['らーめん']],
    ['a prolonged mark with nothing before it', 'ーあ', ['ー', 'あ']],
    ['halfwidth katakana with voicing marks', 'ｺｰﾋﾞｰ', ['ｺｰﾋﾞｰ']],
    ['the kanji iteration mark', '人々が', ['人々', 'が']],
    ['〆 as a kanji', '〆切です', ['〆切', 'です']],
    ['a fullwidth number with a thousands separator', '１，０００円', ['１，０００', '円']],
    ['a decimal number', '3.5km', ['3.5', 'km']],
    ['a separator not between digits', '3,あ. 4.', ['3', 'あ', '4']],
    ['an astral kanji', '𠮷野家', ['𠮷野家']],
    ['Latin letters and digits', 'Tシャツ3枚', ['T', 'シャツ', '3', '枚']],
    ['fullwidth Latin and digits', 'ＡＢＣ１２３', ['ＡＢＣ', '１２３']],
    ['punctuation and spaces dropped', '「はい」、 そう。', ['はい', 'そう']],
    ['symbols dropped', '100%★OK!', ['100', 'OK']],
    ['other scripts kept as one run', '한국어とか', ['한국어', 'とか']],
    ['empty text', '', []],
    ['only punctuation', '。、！？', []],
  ])('splits %s', (_label, text, surfaces) => {
    expect(splitByScript(text).map((t) => t.surface)).toEqual(surfaces);
  });

  it('uses the surface as base form and reading, and makes valid tiles', () => {
    const tiles = splitByScript('日本語です');
    expect(tiles).toEqual([
      { surface: '日本語', base: '日本語', reading: '日本語' },
      { surface: 'です', base: 'です', reading: 'です' },
    ]);
    tiles.forEach((tile) => expect(tileSchema.parse(tile)).toEqual(tile));
  });
});

describe('readingOf', () => {
  it('is the plugin member', () => {
    expect(japanese.readingOf).toBe(readingOf);
  });

  it.each<[string, Tile[], string]>([
    ['the stored tiles', stored, 'わたしはみずをのみました'],
    ['a single tile', [{ surface: '水', base: '水', reading: 'みず' }], 'みず'],
    ['no tiles', [], ''],
  ])('joins the readings of %s with no spaces', (_label, tiles, reading) => {
    expect(readingOf(tiles)).toBe(reading);
  });
});

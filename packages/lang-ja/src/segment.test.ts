import type { AnalyzerToken } from '@manabi/core';
import recorded from './recordedTokens.json';
import { segment } from './segment';

// kuromoji-ipadic tokens recorded by packages/importers' adapter, so these tests need no analyzer.
const tokens = recorded as Record<string, AnalyzerToken[]>;

// [surface, base, reading, counted] per tile.
type Row = [string, string, string, boolean];
const tiles = (text: string): Row[] =>
  segment(tokens[text]!).map((t) => [t.surface, t.base, t.reading, t.counted]);

describe('segment (FR-238, rules R0 to R10)', () => {
  it.each<[string, string, Row[]]>([
    [
      'R0 drops punctuation; R1 prefix joins its noun; R4 する joins its サ変 noun',
      'お休みの日に電話しました。',
      [
        ['お休み', 'お休み', 'おやすみ', true],
        ['の', 'の', 'の', false],
        ['日', '日', 'ひ', true],
        ['に', 'に', 'に', false],
        ['電話しました', '電話する', 'でんわしました', true],
      ],
    ],
    [
      'R2/R3 number and counter; R5 helper verb and R6 endings join the verb',
      '三人で見てきました。',
      [
        ['三人', '三人', 'さんにん', false],
        ['で', 'で', 'で', false],
        ['見てきました', '見る', 'みてきました', true],
      ],
    ],
    [
      'R5 ください stays its own tile (T4)',
      '入れてください。',
      [
        ['入れて', '入れる', 'いれて', true],
        ['ください', 'くださる', 'ください', true],
      ],
    ],
    [
      'R8 nominalizer joins the copula',
      '来たのですか。',
      [
        ['来た', '来る', 'きた', true],
        ['のです', 'の', 'のです', false],
        ['か', 'か', 'か', false],
      ],
    ],
    [
      'R5 ちゃう joins; R8 んじゃない; R9 stacked final particles',
      '雨になっちゃうんじゃないかなあ。',
      [
        ['雨', '雨', 'あめ', true],
        ['に', 'に', 'に', false],
        ['なっちゃう', 'なる', 'なっちゃう', true],
        ['んじゃない', 'ん', 'んじゃない', false],
        ['か', 'か', 'か', false],
        ['なあ', 'なあ', 'なあ', false],
      ],
    ],
    [
      'R7 ではない is one copula tile',
      '学生ではない。',
      [
        ['学生', '学生', 'がくせい', true],
        ['ではない', 'で', 'ではない', false],
      ],
    ],
    [
      'R10 ば joins the copula; place names are not counted',
      'パリならばなあ。',
      [
        ['パリ', 'パリ', 'ぱり', false],
        ['ならば', 'だ', 'ならば', false],
        ['なあ', 'なあ', 'なあ', false],
      ],
    ],
    [
      'idiom split: 気がつく',
      'ふと気がついた。',
      [
        ['ふと', 'ふと', 'ふと', true],
        ['気', '気', 'き', true],
        ['が', 'が', 'が', false],
        ['ついた', 'つく', 'ついた', true],
      ],
    ],
    [
      'idiom split: 後で',
      'また後で。',
      [
        ['また', 'また', 'また', true],
        ['後', '後', 'あと', true],
        ['で', 'で', 'で', false],
      ],
    ],
    [
      'R3 a person suffix keeps a name uncounted; another suffix makes a counted word',
      'ルーシーさんは中国語を話す。',
      [
        ['ルーシーさん', 'ルーシーさん', 'るーしーさん', false],
        ['は', 'は', 'は', false],
        ['中国語', '中国語', 'ちゅうごくご', true],
        ['を', 'を', 'を', false],
        ['話す', '話す', 'はなす', true],
      ],
    ],
  ])('%s: %s', (_rule, text, want) => {
    expect(tiles(text)).toEqual(want);
  });

  it('splits 気に入る and keeps the rest of the conjugation on its last part', () => {
    const t = (surface: string, pos: string[], baseForm: string, reading: string) => ({
      surface,
      pos,
      conjugationType: null,
      conjugationForm: null,
      baseForm,
      reading,
    });
    expect(
      segment([
        t('気に入っ', ['動詞', '自立'], '気に入る', 'キニイッ'),
        t('てる', ['動詞', '非自立'], 'てる', 'テル'),
      ]).map((x) => [x.surface, x.base, x.reading]),
    ).toEqual([
      ['気', '気', 'き'],
      ['に', 'に', 'に'],
      ['入ってる', '入る', 'いってる'],
    ]);
  });

  it('falls back to the surface when the analyzer has no base form or reading', () => {
    expect(
      segment([
        {
          surface: 'ピカチュウ',
          pos: ['名詞', '一般'],
          conjugationType: null,
          conjugationForm: null,
          baseForm: null,
          reading: null,
        },
      ]),
    ).toEqual([
      { surface: 'ピカチュウ', base: 'ピカチュウ', reading: 'ぴかちゅう', counted: true },
    ]);
  });
});

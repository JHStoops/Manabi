import type { ConjugationForm } from './conjugate';
import { conjugate, formsFor, isConjugable } from './conjugate';

// FR-043, FR-049: conjugation rules for every supported class, on written and kana spellings.

const FORMS: ConjugationForm[] = ['masu', 'masen', 'mashita', 'te', 'ta', 'nai', 'nakatta'];

describe('verbs', () => {
  it.each([
    [
      '食べる',
      'v1',
      ['食べます', '食べません', '食べました', '食べて', '食べた', '食べない', '食べなかった'],
    ],
    [
      '書く',
      'v5k',
      ['書きます', '書きません', '書きました', '書いて', '書いた', '書かない', '書かなかった'],
    ],
    [
      '泳ぐ',
      'v5g',
      ['泳ぎます', '泳ぎません', '泳ぎました', '泳いで', '泳いだ', '泳がない', '泳がなかった'],
    ],
    [
      '話す',
      'v5s',
      ['話します', '話しません', '話しました', '話して', '話した', '話さない', '話さなかった'],
    ],
    [
      '待つ',
      'v5t',
      ['待ちます', '待ちません', '待ちました', '待って', '待った', '待たない', '待たなかった'],
    ],
    [
      '死ぬ',
      'v5n',
      ['死にます', '死にません', '死にました', '死んで', '死んだ', '死なない', '死ななかった'],
    ],
    [
      '遊ぶ',
      'v5b',
      ['遊びます', '遊びません', '遊びました', '遊んで', '遊んだ', '遊ばない', '遊ばなかった'],
    ],
    [
      '飲む',
      'v5m',
      ['飲みます', '飲みません', '飲みました', '飲んで', '飲んだ', '飲まない', '飲まなかった'],
    ],
    [
      '帰る',
      'v5r',
      ['帰ります', '帰りません', '帰りました', '帰って', '帰った', '帰らない', '帰らなかった'],
    ],
    [
      '買う',
      'v5u',
      ['買います', '買いません', '買いました', '買って', '買った', '買わない', '買わなかった'],
    ],
    [
      '行く',
      'v5k-s',
      ['行きます', '行きません', '行きました', '行って', '行った', '行かない', '行かなかった'],
    ],
    [
      '問う',
      'v5u-s',
      ['問います', '問いません', '問いました', '問うて', '問うた', '問わない', '問わなかった'],
    ],
    [
      'ある',
      'v5r-i',
      ['あります', 'ありません', 'ありました', 'あって', 'あった', 'ない', 'なかった'],
    ],
    [
      'いらっしゃる',
      'v5aru',
      [
        'いらっしゃいます',
        'いらっしゃいません',
        'いらっしゃいました',
        'いらっしゃって',
        'いらっしゃった',
        'いらっしゃらない',
        'いらっしゃらなかった',
      ],
    ],
    ['する', 'vs-i', ['します', 'しません', 'しました', 'して', 'した', 'しない', 'しなかった']],
    [
      '勉強する',
      'vs-i',
      [
        '勉強します',
        '勉強しません',
        '勉強しました',
        '勉強して',
        '勉強した',
        '勉強しない',
        '勉強しなかった',
      ],
    ],
    [
      '愛する',
      'vs-s',
      ['愛します', '愛しません', '愛しました', '愛して', '愛した', '愛しない', '愛しなかった'],
    ],
    ['来る', 'vk', ['来ます', '来ません', '来ました', '来て', '来た', '来ない', '来なかった']],
    ['くる', 'vk', ['きます', 'きません', 'きました', 'きて', 'きた', 'こない', 'こなかった']],
    [
      'くれる',
      'v1-s',
      ['くれます', 'くれません', 'くれました', 'くれて', 'くれた', 'くれない', 'くれなかった'],
    ],
  ])('%s (%s)', (text, pos, expected) => {
    expect(FORMS.map((form) => conjugate(text, pos, form))).toEqual(expected);
  });

  it('has the same results for the kana spelling', () => {
    expect(conjugate('たべる', 'v1', 'te')).toBe('たべて');
    expect(conjugate('いく', 'v5k-s', 'ta')).toBe('いった');
    expect(conjugate('かう', 'v5u', 'nai')).toBe('かわない');
  });
});

describe('adjectives', () => {
  it.each([
    ['高い', 'adj-i', ['高くて', '高かった', '高くない', '高くなかった']],
    ['いい', 'adj-ix', ['よくて', 'よかった', 'よくない', 'よくなかった']],
    ['良い', 'adj-ix', ['良くて', '良かった', '良くない', '良くなかった']],
    ['静か', 'adj-na', ['静かで', '静かだった', '静かではない', '静かではなかった']],
  ])('%s (%s)', (text, pos, expected) => {
    expect((['te', 'ta', 'nai', 'nakatta'] as const).map((f) => conjugate(text, pos, f))).toEqual(
      expected,
    );
  });

  it('has no polite forms', () => {
    expect(conjugate('高い', 'adj-i', 'masu')).toBeUndefined();
    expect(formsFor('adj-na')).not.toContain('masu');
  });
});

describe('unsupported input', () => {
  it.each(['n', 'adv', 'v5uru', 'vs', 'v2k-s', 'prt', ''])('does not conjugate %j', (pos) => {
    expect(isConjugable(pos)).toBe(false);
    expect(formsFor(pos)).toEqual([]);
    expect(conjugate('食べる', pos, 'te')).toBeUndefined();
  });

  it.each([
    ['食べた', 'v1'],
    ['書く', 'v5g'],
    ['書く', 'v1'],
    ['高', 'adj-i'],
    ['行く', 'vk'],
    ['する', 'vk'],
    ['食べる', 'vs-i'],
  ])('rejects %s as %s', (text, pos) => {
    expect(conjugate(text, pos, 'te')).toBeUndefined();
  });
});

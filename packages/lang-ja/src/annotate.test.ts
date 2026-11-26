import type { Item, Tile } from '@manabi/core';
import japanese from './index';

// FR-140, Product Spec section 8: furigana always, for unlearned kanji only, or never.

const kanji = (character: string) =>
  ({
    id: 1,
    key: `ja:kanji:${character}`,
    type: 'kanji',
    data: { character, meanings: ['x'], onReadings: [], kunReadings: [], strokeCount: 1 },
    overrides: {},
  }) as unknown as Item;

// 私は日本語を食べる。 as stored tiles.
const tiles: Tile[] = [
  { surface: '私', base: '私', reading: 'わたし' },
  { surface: 'は', base: 'は', reading: 'は' },
  { surface: '日本語', base: '日本語', reading: 'にほんご' },
  { surface: 'を', base: 'を', reading: 'を' },
  { surface: '食べる', base: '食べる', reading: 'たべる' },
];

const furigana = (start: number, end: number, value: string) => ({
  start,
  end,
  kind: 'furigana',
  value,
});

describe('annotate', () => {
  it('always: annotates every tile with kanji, leaving okurigana bare', () => {
    expect(japanese.annotate(tiles, [kanji('私')], 'always')).toEqual([
      furigana(0, 1, 'わたし'),
      furigana(2, 5, 'にほんご'),
      furigana(6, 7, 'た'),
    ]);
  });

  it('unlearned: skips tiles whose kanji are all learned (stage 4 and up)', () => {
    const learned = ['私', '日', '本', '食'].map(kanji);
    // 語 is not learned, so the whole word keeps its reading.
    expect(japanese.annotate(tiles, learned, 'unlearned')).toEqual([furigana(2, 5, 'にほんご')]);
    expect(japanese.annotate(tiles, [], 'unlearned')).toHaveLength(3);
  });

  it('never: no annotations', () => {
    expect(japanese.annotate(tiles, [], 'never')).toEqual([]);
  });

  it('trims a leading kana prefix and ignores fallback tiles', () => {
    expect(
      japanese.annotate(
        [
          { surface: 'お茶', base: 'お茶', reading: 'おちゃ' },
          // Fallback tiles have the surface as reading and never get furigana (SDD section 4).
          { surface: '水', base: '水', reading: '水' },
        ],
        [],
        'always',
      ),
    ).toEqual([furigana(1, 2, 'ちゃ')]);
  });

  it('unlearned: 々 does not keep furigana on a word whose kanji are learned', () => {
    const hitobito: Tile[] = [{ surface: '人々', base: '人々', reading: 'ひとびと' }];
    expect(japanese.annotate(hitobito, [kanji('人')], 'unlearned')).toEqual([]);
    expect(japanese.annotate(hitobito, [], 'unlearned')).toEqual([furigana(0, 2, 'ひとびと')]);
  });

  it('trims katakana parts of a word against the hiragana reading', () => {
    expect(
      japanese.annotate(
        [{ surface: 'ドイツ語', base: 'ドイツ語', reading: 'どいつご' }],
        [],
        'always',
      ),
    ).toEqual([furigana(3, 4, 'ご')]);
  });
});

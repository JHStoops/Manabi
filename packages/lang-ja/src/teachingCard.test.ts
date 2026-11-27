import type { Item } from '@manabi/core';
import { KANA_SECTION_LEVEL } from './generators';
import japanese from './index';

// Product Spec section 4 (teaching cards), FR-141: what a card shows for each item type.

const item = (type: string, data: object, overrides: object = {}) =>
  ({ id: 1, key: `ja:${type}:x`, type, data, overrides }) as unknown as Item;
const card = (i: Item, level = 'N5') => japanese.teachingCard(i, level);

describe('teachingCard', () => {
  const kana = item('kana', { character: 'か', script: 'hiragana', romaji: 'ka' });
  const word = item('word', {
    written: '水',
    reading: 'みず',
    senses: [
      { partsOfSpeech: ['n'], meanings: ['water', 'fluid'] },
      { partsOfSpeech: ['n'], meanings: ['flood'] },
    ],
  });

  it('shows a kana with its romaji in the kana section only (FR-141)', () => {
    expect(card(kana, KANA_SECTION_LEVEL)).toEqual({
      term: 'か',
      reading: 'ka',
      meaning: null,
      spoken: 'か',
    });
    expect(card(kana)).toEqual({
      term: 'か',
      reading: null,
      meaning: null,
      spoken: 'か',
    });
  });

  it('shows a word with its kana reading and every meaning, plus romaji in the kana section', () => {
    expect(card(word)).toEqual({
      term: '水',
      reading: 'みず',
      meaning: 'water, fluid; flood',
      spoken: 'みず',
    });
    expect(card(word, KANA_SECTION_LEVEL).reading).toBe('みず · mizu');
    const kanaWord = item('word', { ...word.data, written: 'いえ', reading: 'いえ' });
    expect(card(kanaWord).reading).toBeNull();
    expect(card(kanaWord, KANA_SECTION_LEVEL).reading).toBe('ie');
  });

  it('shows a kanji with its readings and meanings', () => {
    const kanji = item('kanji', {
      character: '日',
      meanings: ['day', 'sun'],
      onReadings: ['ニチ'],
      kunReadings: ['ひ'],
      strokeCount: 4,
    });
    expect(card(kanji)).toEqual({
      term: '日',
      reading: 'ニチ、ひ',
      meaning: 'day, sun',
      spoken: 'ひ',
    });
  });

  it('speaks a kanji without the KANJIDIC okurigana and affix markers', () => {
    const data = { character: '食', meanings: ['eat'], onReadings: ['ショク'], strokeCount: 9 };
    expect(card(item('kanji', { ...data, kunReadings: ['た.べる'] })).spoken).toBe('たべる');
    expect(card(item('kanji', { ...data, kunReadings: ['-ぐい'] })).spoken).toBe('ぐい');
  });

  it('shows a grammar point with its pattern, meaning and formation table (Product Spec 6)', () => {
    const formation = [{ wordType: 'Verb', form: 'te-form + ください', example: '見てください' }];
    expect(
      card(item('grammar', { pattern: 'Verb-te + ください', meaning: 'please do', formation })),
    ).toEqual({
      term: 'Verb-te + ください',
      reading: null,
      meaning: 'please do',
      spoken: '',
      formation,
    });
    // A stub has only its pattern.
    expect(card(item('grammar', { pattern: 'はず' }))).toMatchObject({
      meaning: null,
      formation: [],
    });
  });

  it("applies the author's overrides, and falls back to the key for invalid data", () => {
    expect(card(item('word', word.data, { senses: [{ meanings: ['H2O'] }] })).meaning).toBe('H2O');
    expect(card(item('grammar', { pattern: 'は', unknown: 1 }))).toEqual({
      term: 'ja:grammar:x',
      reading: null,
      meaning: null,
      spoken: 'ja:grammar:x',
    });
  });

  describe("a kanji's meaning and reading cards (Product Spec section 5, #237)", () => {
    const hi = item('kanji', {
      character: '日',
      meanings: ['day', 'sun'],
      onReadings: ['ニチ', 'ジツ'],
      kunReadings: ['ひ', '-び', '-か'],
      strokeCount: 4,
    });
    const wordOf = (id: number, written: string, reading: string) =>
      ({
        ...item('word', { written, reading, senses: [{ partsOfSpeech: ['n'], meanings: ['x'] }] }),
        id,
      }) as Item;

    it('shows the meaning only on the meaning card, without speaking the reading', () => {
      expect(japanese.teachingCard(hi, 'N5', { facet: 'meaning' })).toEqual({
        term: '日',
        reading: null,
        meaning: 'day, sun',
        spoken: '',
      });
    });

    it('shows the reading most of its words use, in KANJIDIC form, on the reading card', () => {
      const words = [
        wordOf(2, '日本', 'にほん'),
        wordOf(3, '毎日', 'まいにち'),
        wordOf(4, '日曜日', 'にちようび'),
      ];
      // 日本 cannot be told for sure (no on reading にほ); 毎日 uses にち; 日曜日 has 日 twice.
      expect(japanese.teachingCard(hi, 'N5', { facet: 'reading', words })).toEqual({
        term: '日',
        reading: 'ニチ',
        meaning: null,
        spoken: 'にち',
      });
      const kun = [
        wordOf(5, '日々', 'ひび'),
        wordOf(6, '日帰り', 'ひがえり'),
        wordOf(7, '毎日', 'まいにち'),
      ];
      expect(japanese.teachingCard(hi, 'N5', { facet: 'reading', words: kun }).reading).toBe('ひ');
    });

    it('falls back to the first on reading, then the first kun reading, without words', () => {
      expect(japanese.teachingCard(hi, 'N5', { facet: 'reading' })).toMatchObject({
        reading: 'ニチ',
        spoken: 'にち',
      });
      const kunOnly = item('kanji', { ...hi.data, onReadings: [], kunReadings: ['た.べる'] });
      expect(japanese.teachingCard(kunOnly, 'N5', { facet: 'reading' })).toMatchObject({
        reading: 'た.べる',
        spoken: 'たべる',
      });
    });

    it('ignores the facet for other items', () => {
      expect(japanese.teachingCard(word, 'N5', { facet: 'meaning' })).toEqual(card(word));
    });
  });
});

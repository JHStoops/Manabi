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
    expect(card(kana, KANA_SECTION_LEVEL)).toEqual({ term: 'か', reading: 'ka', meaning: null });
    expect(card(kana)).toEqual({ term: 'か', reading: null, meaning: null });
  });

  it('shows a word with its kana reading and every meaning, plus romaji in the kana section', () => {
    expect(card(word)).toEqual({ term: '水', reading: 'みず', meaning: 'water, fluid; flood' });
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
    expect(card(kanji)).toEqual({ term: '日', reading: 'ニチ、ひ', meaning: 'day, sun' });
  });

  it("applies the author's overrides, and falls back to the key for other items", () => {
    expect(card(item('word', word.data, { senses: [{ meanings: ['H2O'] }] })).meaning).toBe('H2O');
    expect(card(item('grammar', { pattern: 'は' }))).toEqual({
      term: 'ja:grammar:x',
      reading: null,
      meaning: null,
    });
  });
});

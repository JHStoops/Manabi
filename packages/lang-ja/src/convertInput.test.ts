import { convertInput } from './convertInput';

const romaji = (text: string) => convertInput(text, 'romaji');

// What a learner sees typing `keys` one at a time: the field's text is fed back after each key.
const typed = (keys: string) =>
  [...keys].reduce((value, key) => convertInput(value + key, 'romaji'), '');

describe('convertInput (FR-142)', () => {
  it.each([
    ['ka', 'か'],
    ['nihongo', 'にほんご'],
    ['KA', 'カ'],
    ['Ka', 'カ'],
    ['KYOU', 'キョウ'],
    ['kya', 'きゃ'],
    ['sha', 'しゃ'],
    ['xtu', 'っ'],
    ['kitte', 'きって'],
    ['KITTE', 'キッテ'],
    ['nn ', 'ん '],
    ['kanna', 'かんな'],
    ['kantan', 'かんたn'],
    ['kanji', 'かんじ'],
    ['konnichiha', 'こんにちは'],
    ['ra-men', 'らーめn'],
    ['ra-men ', 'らーめん '],
    ['ka na', 'か な'],
  ])('converts %s to %s', (input, expected) => {
    expect(romaji(input)).toBe(expected);
  });

  it.each([
    ['ka', 'か'],
    ['KA', 'カ'],
    ['KKA', 'ッカ'],
    ['KITTE', 'キッテ'],
    ['KYOU', 'キョウ'],
    ['kitte', 'きって'],
    ['konnichiha', 'こんにちは'],
    ['kanna', 'かんな'],
    ['sennen ', 'せんねん '],
    ['onna', 'おんな'],
    ['kann ', 'かん '],
  ])('converts %s to %s typed one key at a time', (keys, expected) => {
    expect(typed(keys)).toBe(expected);
  });

  it('keeps a trailing n or nn until the next key shows what it is', () => {
    expect(romaji('kan')).toBe('かn');
    expect(romaji('KAN')).toBe('カN');
    expect(romaji('kann')).toBe('かnn');
    expect(romaji('kanna')).toBe('かんな');
    expect(romaji('kan ')).toBe('かん ');
  });

  it('is stable on its own output and leaves kana and other input alone', () => {
    expect(romaji('かn')).toBe('かn');
    expect(romaji(romaji('kanna'))).toBe('かんな');
    expect(romaji('にほんご、カタカナ 123')).toBe('にほんご、カタカナ 123');
  });

  it('leaves text unchanged for an unknown mode', () => {
    expect(convertInput('ka', 'none')).toBe('ka');
  });
});

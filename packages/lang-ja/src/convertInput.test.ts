import { convertInput } from './convertInput';

const romaji = (text: string) => convertInput(text, 'romaji');

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
    ['nn', 'ん'],
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

  it('keeps a trailing lone n until the next key shows what it is', () => {
    expect(romaji('kan')).toBe('かn');
    expect(romaji('KAN')).toBe('カN');
    expect(romaji('kann')).toBe('かん');
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

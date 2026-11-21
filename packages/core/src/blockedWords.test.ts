import { findBlockedWords } from './index';

describe('findBlockedWords (FR-237)', () => {
  const blocked = new Set(['食べる', 'くそ']);

  it('finds a blocked verb in its conjugated form by the tile base form', () => {
    const tiles = [
      { surface: '私', base: '私' },
      { surface: '食べました', base: '食べる' },
    ];
    expect(findBlockedWords(tiles, blocked)).toEqual(['食べる']);
  });

  it('matches surfaces, lists each word once and finds nothing in clean tiles', () => {
    const tiles = [
      { surface: 'くそ', base: 'くそ' },
      { surface: 'くそ', base: 'くそ' },
    ];
    expect(findBlockedWords(tiles, blocked)).toEqual(['くそ']);
    expect(findBlockedWords([{ surface: '水', base: '水' }], blocked)).toEqual([]);
  });
});

import { kanaDataSchema } from './itemSchemas';
import { courseKana } from './kana';

describe('courseKana', () => {
  it('lists 71 hiragana and 71 katakana, each a valid kana item', () => {
    expect(courseKana).toHaveLength(142);
    expect(new Set(courseKana.map((k) => k.character)).size).toBe(142);
    for (const kana of courseKana) expect(kanaDataSchema.parse(kana)).toEqual(kana);
  });

  it('pairs each character with its romaji', () => {
    const romaji = Object.fromEntries(courseKana.map((k) => [k.character, k.romaji]));
    expect(romaji).toMatchObject({ あ: 'a', し: 'shi', を: 'wo', ん: 'n', ぽ: 'po' });
    expect(romaji).toMatchObject({ ア: 'a', ツ: 'tsu', ヲ: 'wo', ン: 'n', ヂ: 'ji', ポ: 'po' });
  });
});

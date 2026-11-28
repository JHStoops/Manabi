import { reviewFacets, testsFacet } from './reviewFacets';

describe('reviewFacets (FR-110)', () => {
  it('gives each item type its facets and their exercise types', () => {
    expect(reviewFacets('kana')).toEqual({ reading: ['choice', 'typed_answer'] });
    expect(reviewFacets('kanji')).toEqual({
      meaning: ['choice', 'typed_answer'],
      reading: ['reading_in_context'],
    });
    expect(reviewFacets('word')).toEqual({
      meaning: ['choice', 'typed_answer'],
      reading: ['typed_answer'],
    });
    expect(reviewFacets('grammar')).toEqual({ usage: ['fill_blank', 'reorder'] });
  });

  it('gives unknown types no facets', () => {
    expect(reviewFacets('toString')).toEqual({});
  });
});

describe('testsFacet (FR-112)', () => {
  const typed = (answerLanguage: string) => ({
    type: 'typed_answer',
    payload: { prompt: 'p', answerLanguage, accept: [{ text: 'a', tiles: [] }] },
  });
  const choice = (itemIds: (number | undefined)[]) => ({
    type: 'choice',
    payload: {
      prompt: 'p',
      options: itemIds.map((itemId, i) => ({ text: `o${i}`, ...(itemId ? { itemId } : {}) })),
      correct: 0,
    },
  });

  it("serves a kanji's meaning only with exercises that ask for it", () => {
    expect(testsFacet(typed('base'), 'kanji', 'meaning')).toBe(true);
    expect(testsFacet(typed('target'), 'kanji', 'meaning')).toBe(false);
    expect(testsFacet(choice([1, 2, 3, 4]), 'kanji', 'meaning')).toBe(true);
    expect(
      testsFacet(choice([undefined, undefined, undefined, undefined]), 'kanji', 'meaning'),
    ).toBe(false);
  });

  it("serves a word's reading with kana typed answers and its meaning with the rest (#225)", () => {
    const typedText = (answerLanguage: string, ...texts: string[]) => ({
      type: 'typed_answer',
      payload: { prompt: 'p', answerLanguage, accept: texts.map((text) => ({ text, tiles: [] })) },
    });
    const reading = typedText('target', 'みず');
    const kanaSpelling = typedText('target', 'コーヒー', 'こーひー');
    const written = typedText('target', '水');
    const english = typedText('base', 'water');
    expect(testsFacet(reading, 'word', 'reading')).toBe(true);
    expect(testsFacet(kanaSpelling, 'word', 'reading')).toBe(true);
    expect(testsFacet(reading, 'word', 'meaning')).toBe(false);
    expect(testsFacet(written, 'word', 'meaning')).toBe(true);
    expect(testsFacet(written, 'word', 'reading')).toBe(false);
    expect(testsFacet(english, 'word', 'meaning')).toBe(true);
    expect(testsFacet(english, 'word', 'reading')).toBe(false);
    expect(testsFacet(choice([1, 2, 3, 4]), 'word', 'meaning')).toBe(true);
  });

  it('serves other facets and item types with any exercise of their types', () => {
    expect(testsFacet(typed('target'), 'kanji', 'reading')).toBe(true);
  });
});

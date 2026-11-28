import type { Item } from '@manabi/core';
import { generators } from './generators';
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

  it("serves a word's reading with kana-tile reading questions and its meaning with the rest (#225)", () => {
    const tile = (surface: string, base: string) => ({
      surface,
      base,
      reading: surface,
      itemId: 1,
    });
    const typedTiles = (
      answerLanguage: string,
      ...accept: [string, ReturnType<typeof tile>[]][]
    ) => ({
      type: 'typed_answer',
      payload: {
        prompt: 'p',
        answerLanguage,
        accept: accept.map(([text, tiles]) => ({ text, tiles })),
      },
    });
    // How do you read 水? (with an answer added from a report, which keeps it a reading question)
    const reading = typedTiles('target', ['みず', [tile('みず', '水')]], ['水', []]);
    // Which word means “water”? / Which word means “coffee”? (a kana-only word)
    const written = typedTiles('target', ['水', [tile('水', '水')]]);
    const kanaWord = typedTiles('target', ['コーヒー', [tile('コーヒー', 'コーヒー')]]);
    const untiled = typedTiles('target', ['みず', []]);
    const english = typedTiles('base', ['water', []]);
    expect(testsFacet(reading, 'word', 'reading')).toBe(true);
    expect(testsFacet(reading, 'word', 'meaning')).toBe(false);
    for (const meaning of [written, kanaWord, untiled, english]) {
      expect(testsFacet(meaning, 'word', 'meaning')).toBe(true);
      expect(testsFacet(meaning, 'word', 'reading')).toBe(false);
    }
    expect(testsFacet(typed('target'), 'word', 'meaning')).toBe(true);
    expect(testsFacet(choice([1, 2, 3, 4]), 'word', 'meaning')).toBe(true);
  });

  it('serves other facets and item types with any exercise of their types', () => {
    expect(testsFacet(typed('target'), 'kanji', 'reading')).toBe(true);
  });
});

describe('testsFacet with generated word exercises (#225)', () => {
  const water = {
    id: 1,
    courseId: 1,
    key: 'w',
    type: 'word',
    levelCode: 'N5',
    data: {
      written: '水',
      reading: 'みず',
      senses: [{ partsOfSpeech: ['n'], meanings: ['water'] }],
    },
    overrides: {},
    source: null,
    datasetVersion: null,
    archivedAt: null,
  } as Item;
  const ctx = { sectionLevel: 'N5', taughtItems: [water], sentences: [] };

  it('keeps a generated reading exercise in reading and meaning typed answers in meaning', () => {
    const [reading] = generators.typed_answer!(water, { ...ctx, facet: 'reading' });
    expect(testsFacet(reading!, 'word', 'reading')).toBe(true);
    expect(testsFacet(reading!, 'word', 'meaning')).toBe(false);
    for (let i = 0; i < 20; i++) {
      const [meaning] = generators.typed_answer!(water, ctx);
      expect(testsFacet(meaning!, 'word', 'meaning')).toBe(true);
      expect(testsFacet(meaning!, 'word', 'reading')).toBe(false);
    }
  });
});

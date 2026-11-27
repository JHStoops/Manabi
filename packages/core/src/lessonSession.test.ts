import {
  KANJI_LESSON_FLOW,
  lessonFlows,
  lessonRecipes,
  payloadItemIds,
  teachingCardSchema,
} from './lessonSession';

describe('payloadItemIds (FR-048)', () => {
  it('collects every itemId in tiles and option refs, at any depth', () => {
    const payload = {
      prompt: 'pick',
      options: [{ itemId: 1 }, { itemId: 2, label: 'x' }],
      accept: [{ text: 'a', tiles: [{ surface: 'a', base: 'a', reading: 'a', itemId: 3 }] }],
      itemId: 'not a number',
    };
    expect(payloadItemIds(payload)).toEqual([1, 2, 3]);
    expect(payloadItemIds({ prompt: 'none' })).toEqual([]);
  });
});

describe('kanji lesson flow (Product Spec section 5, #53)', () => {
  it('runs trace, meaning, reading, words, then draw from memory, in that order', () => {
    expect(lessonFlows.kanji).toBe(KANJI_LESSON_FLOW);
    expect(KANJI_LESSON_FLOW.map((s) => `${s.type}:${s.facet ?? s.targets ?? ''}`)).toEqual([
      'stroke_trace:',
      'choice:meaning',
      'typed_answer:meaning',
      'reading_in_context:reading',
      'typed_answer:reading',
      'choice:containing',
      'match_pairs:containing',
      'draw_memory:',
    ]);
  });

  it('makes the trace and the draw from memory for every kanji', () => {
    expect(KANJI_LESSON_FLOW.filter((s) => s.everyItem).map((s) => s.type)).toEqual([
      'stroke_trace',
      'draw_memory',
    ]);
  });

  it('is the only flow; other lesson types keep their recipes', () => {
    expect(Object.keys(lessonFlows)).toEqual(['kanji']);
    expect(new Set(lessonRecipes.kanji)).toEqual(new Set(KANJI_LESSON_FLOW.map((s) => s.type)));
  });
});

describe('teachingCardSchema', () => {
  it('reads cards saved before #53 with no words and no stroke animation', () => {
    const item = {
      id: 1,
      courseId: 1,
      key: 'k',
      type: 'kanji',
      levelCode: 'N5',
      data: {},
      overrides: {},
      source: null,
      datasetVersion: null,
      archivedAt: null,
    };
    expect(teachingCardSchema.parse({ item, examples: [] })).toEqual({
      item,
      examples: [],
      words: [],
      strokeAnimation: false,
    });
  });
});

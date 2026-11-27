import {
  KANJI_LESSON_FLOW,
  isFlowCard,
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

const exerciseSteps = KANJI_LESSON_FLOW.flatMap((s) => (isFlowCard(s) ? [] : [s]));

describe('kanji lesson flow (Product Spec section 5, #53, #237)', () => {
  it('runs the meaning card, trace, meaning, the reading card, reading, words, then draw from memory', () => {
    expect(lessonFlows.kanji).toBe(KANJI_LESSON_FLOW);
    expect(
      KANJI_LESSON_FLOW.map((s) =>
        isFlowCard(s) ? `card:${s.card}` : `${s.type}:${s.facet ?? s.targets ?? ''}`,
      ),
    ).toEqual([
      'card:meaning',
      'stroke_trace:',
      'choice:meaning',
      'typed_answer:meaning',
      'card:reading',
      'reading_in_context:reading',
      'typed_answer:reading',
      'choice:containing',
      'match_pairs:containing',
      'draw_memory:',
    ]);
  });

  it('makes the trace and the draw from memory for every kanji', () => {
    expect(exerciseSteps.filter((s) => s.everyItem).map((s) => s.type)).toEqual([
      'stroke_trace',
      'draw_memory',
    ]);
  });

  it('is the only flow; other lesson types keep their recipes', () => {
    expect(Object.keys(lessonFlows)).toEqual(['kanji']);
    expect(new Set(lessonRecipes.kanji)).toEqual(new Set(exerciseSteps.map((s) => s.type)));
  });
});

describe('teachingCardSchema', () => {
  it('reads cards saved before #53 and #237 as one card per item, before every exercise', () => {
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
      facet: null,
      before: 0,
    });
  });
});

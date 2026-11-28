import {
  KANJI_LESSON_FLOW,
  chooseRefreshers,
  isFlowCard,
  lessonFlows,
  lessonRecipes,
  maxTeachingCards,
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
  it('reads cards saved before #53, #237 and #256 as one new-item card per item, before every exercise', () => {
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
      refresher: false,
    });
  });
});

describe('refresher cards (FR-041, FR-048, #256)', () => {
  /** An exercise that names these items, as a choice's options do. */
  const uses = (...ids: number[]) => ({
    type: 'choice',
    payload: { options: ids.map((itemId) => ({ text: String(itemId), itemId })) },
  });
  const item = (id: number) => ({ id });
  // Ten exercises: 1 and 2 are the lesson's new items; 10, 11, 12 and 13 were taught earlier.
  const exercises = [
    uses(1),
    uses(1, 11),
    uses(2),
    uses(2, 10),
    uses(1),
    uses(11),
    uses(2, 12),
    uses(1),
    uses(2, 13),
    uses(1, 2),
  ];

  it('caps the cards at 3 for every 5 exercises', () => {
    expect([10, 11, 14, 15].map((n) => maxTeachingCards(n))).toEqual([6, 6, 8, 9]);
    expect(maxTeachingCards(14, { cards: 3, exercises: 7 })).toBe(6);
    expect(maxTeachingCards(10, { cards: 0, exercises: 5 })).toBe(0);
  });

  it('places each card before the first exercise that uses its item, in showing order', () => {
    expect(chooseRefreshers([item(10), item(11)], exercises, 2)).toEqual([
      { item: item(11), before: 1 },
      { item: item(10), before: 3 },
    ]);
  });

  it('only makes cards for candidates the exercises use (earlier items, chosen by the caller)', () => {
    // 99 is not in any exercise; the caller never passes the lesson's own items.
    expect(chooseRefreshers([item(99), item(12)], exercises, 0)).toEqual([
      { item: item(12), before: 6 },
    ]);
  });

  it('fills only what the cap leaves after the lesson cards, most needed first', () => {
    // 10 exercises allow 6 cards; 4 lesson cards leave room for 2 of the 4 candidates.
    const chosen = chooseRefreshers([item(13), item(12), item(11), item(10)], exercises, 4);
    expect(chosen).toEqual([
      { item: item(12), before: 6 },
      { item: item(13), before: 8 },
    ]);
    expect(4 + chosen.length).toBeLessThanOrEqual(maxTeachingCards(exercises.length));
    // A lesson at or over the cap with its own cards gets none.
    expect(chooseRefreshers([item(10)], exercises, 6)).toEqual([]);
    expect(chooseRefreshers([item(10)], exercises, 9)).toEqual([]);
    // A candidate listed twice gets one card.
    expect(chooseRefreshers([item(10), item(10)], exercises, 0)).toHaveLength(1);
  });
});

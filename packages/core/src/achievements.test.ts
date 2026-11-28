import {
  achievementsSeenRequestSchema,
  isFullScreenCelebration,
  newlyEarned,
  parseMetric,
} from './achievements';

// FR-165: the pure parts of the achievements engine.

describe('parseMetric', () => {
  it('splits a family from its data argument', () => {
    expect(parseMetric('streak_days')).toEqual({ family: 'streak_days', arg: null });
    expect(parseMetric('familiar_items:kanji')).toEqual({ family: 'familiar_items', arg: 'kanji' });
    expect(parseMetric('section_complete:ja:N5')).toEqual({
      family: 'section_complete',
      arg: 'ja:N5',
    });
  });

  it('rejects unknown families and a missing or unexpected argument', () => {
    expect(parseMetric('mystery')).toBeNull();
    expect(parseMetric('familiar_items')).toBeNull();
    expect(parseMetric('familiar_items:')).toBeNull();
    expect(parseMetric('streak_days:7')).toBeNull();
  });
});

describe('newlyEarned', () => {
  const definitions = [
    { key: 'streak_7', metric: 'streak_days', threshold: 7 },
    { key: 'streak_30', metric: 'streak_days', threshold: 30 },
    { key: 'kanji_10', metric: 'familiar_items:kanji', threshold: 10 },
  ];

  it.each([
    [6, []],
    [7, ['streak_7']],
    [29, ['streak_7']],
    [30, ['streak_7', 'streak_30']],
    [365, ['streak_7', 'streak_30']],
  ])('a %i-day streak meets %j', (days, keys) => {
    expect(newlyEarned(definitions, new Map([['streak_days', days]]), new Set())).toEqual(keys);
  });

  it('skips achievements already earned and metrics with no value', () => {
    const values = new Map([['streak_days', 30]]);
    expect(newlyEarned(definitions, values, new Set(['streak_7']))).toEqual(['streak_30']);
    expect(newlyEarned(definitions, new Map(), new Set())).toEqual([]);
  });
});

describe('celebrations', () => {
  it('shows streak milestones full-screen (Product Spec section 9)', () => {
    expect(isFullScreenCelebration({ group: 'streak' })).toBe(true);
    expect(isFullScreenCelebration({ group: 'kanji' })).toBe(false);
  });

  it('accepts 1 to 100 keys to mark seen', () => {
    expect(achievementsSeenRequestSchema.safeParse({ keys: [] }).success).toBe(false);
    expect(achievementsSeenRequestSchema.safeParse({ keys: ['streak_7'] }).success).toBe(true);
  });
});

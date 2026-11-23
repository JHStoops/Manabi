import { XP_RULES, levelForXp, levelProgress, lessonXpReasons, xpForLevel } from './index';

describe('XP_RULES (Product Spec section 9)', () => {
  it('matches the XP table', () => {
    expect(XP_RULES).toEqual({
      lesson_new: 10,
      lesson_accuracy_bonus: 5,
      lesson_replay: 5,
      review_correct: 1,
      unit_review: 20,
      test_out: 30,
      drill: 5,
    });
  });

  it('uses reason codes the xp_events.reason CHECK accepts', () => {
    for (const reason of Object.keys(XP_RULES)) expect(reason).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe('lessonXpReasons (FR-055, FR-160)', () => {
  it('gives a new lesson 10, plus 5 at 90% or better', () => {
    expect(lessonXpReasons(true, 89)).toEqual(['lesson_new']);
    expect(lessonXpReasons(true, 90)).toEqual(['lesson_new', 'lesson_accuracy_bonus']);
  });

  it('gives a replay 5 and no bonus', () => {
    expect(lessonXpReasons(false, 100)).toEqual(['lesson_replay']);
  });
});

describe('levels (FR-162)', () => {
  it('puts level 2 at 100, 3 at 300, 4 at 600', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
  });

  it.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [299, 2],
    [300, 3],
    [599, 3],
    [600, 4],
    [xpForLevel(200), 200],
    [xpForLevel(200) - 1, 199],
  ])('%i XP is level %i', (xp, level) => {
    expect(levelForXp(xp)).toBe(level);
  });

  it('reports progress within the level', () => {
    expect(levelProgress(350)).toEqual({ level: 3, xpIntoLevel: 50, xpForNextLevel: 300 });
    expect(levelProgress(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
  });
});

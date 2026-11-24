import { advanceStreak, settleMissedDays } from './streak';
import type { StreakState } from './streak';

// FR-163, FR-164: streak edge cases. Dates are the learner's local dates, so a time zone or a
// daylight saving change only shows up as which date the ledger recorded, never in the arithmetic.

const state = (over: Partial<StreakState> = {}): StreakState => ({
  currentStreak: 3,
  longestStreak: 5,
  freezes: 0,
  lastActiveDate: '2026-11-20',
  ...over,
});

describe('advanceStreak', () => {
  it('starts a streak at 1 for a new learner', () => {
    const fresh = state({ currentStreak: 0, longestStreak: 0, lastActiveDate: null });
    expect(advanceStreak(fresh, '2026-11-23')).toEqual(
      state({ currentStreak: 1, longestStreak: 1, lastActiveDate: '2026-11-23' }),
    );
  });

  it('adds a day when the last active day was yesterday, and raises the longest streak', () => {
    expect(advanceStreak(state({ currentStreak: 5 }), '2026-11-21')).toMatchObject({
      currentStreak: 6,
      longestStreak: 6,
      lastActiveDate: '2026-11-21',
    });
  });

  it('counts a day only once', () => {
    const done = state({ lastActiveDate: '2026-11-21' });
    expect(advanceStreak(done, '2026-11-21')).toBe(done);
    expect(advanceStreak(done, '2026-11-20')).toBe(done);
  });

  it.each([
    // missed days, freezes held, streak after, freezes after
    [1, 0, 1, 0],
    [1, 1, 4, 0],
    [1, 2, 4, 1],
    [2, 0, 1, 0],
    [2, 1, 1, 1],
    [2, 2, 4, 0],
    [3, 2, 1, 2],
  ])(
    'after %i missed days holding %i freezes: streak %i, %i freezes left',
    (missed, freezes, streak, left) => {
      const today = new Date(Date.UTC(2026, 10, 20 + missed + 1)).toISOString().slice(0, 10);
      expect(advanceStreak(state({ freezes }), today)).toMatchObject({
        currentStreak: streak,
        freezes: left,
        lastActiveDate: today,
      });
    },
  );

  it('grants a freeze on every 7th day and holds at most 2', () => {
    const at6 = state({ currentStreak: 6, freezes: 0 });
    expect(advanceStreak(at6, '2026-11-21').freezes).toBe(1);
    expect(advanceStreak({ ...at6, freezes: 2 }, '2026-11-21').freezes).toBe(2);
    expect(advanceStreak({ ...at6, currentStreak: 5 }, '2026-11-21').freezes).toBe(0);
  });

  it('does not grant a freeze when a restart lands on 1, and keeps the longest streak', () => {
    const lost = advanceStreak(state({ currentStreak: 6, longestStreak: 9 }), '2026-11-25');
    expect(lost).toMatchObject({ currentStreak: 1, longestStreak: 9, freezes: 0 });
  });

  it('works across a month, year and leap day', () => {
    const from = (lastActiveDate: string, today: string) =>
      advanceStreak(state({ lastActiveDate }), today).currentStreak;
    expect(from('2026-11-30', '2026-12-01')).toBe(4);
    expect(from('2026-12-31', '2027-01-01')).toBe(4);
    expect(from('2028-02-28', '2028-02-29')).toBe(4);
    expect(from('2028-02-28', '2028-03-01')).toBe(1);
  });

  it('is not affected by daylight saving changes', () => {
    // US spring forward (2026-03-08, a 23-hour day) and fall back (2026-11-01, a 25-hour day).
    const from = (lastActiveDate: string, today: string) =>
      advanceStreak(state({ lastActiveDate }), today).currentStreak;
    expect(from('2026-03-07', '2026-03-08')).toBe(4);
    expect(from('2026-03-08', '2026-03-09')).toBe(4);
    expect(from('2026-10-31', '2026-11-01')).toBe(4);
    expect(from('2026-11-01', '2026-11-02')).toBe(4);
    // One missed day across the change is still one freeze.
    const covered = advanceStreak(
      state({ freezes: 1, lastActiveDate: '2026-03-07' }),
      '2026-03-09',
    );
    expect(covered).toMatchObject({ currentStreak: 4, freezes: 0 });
  });
});

describe('settleMissedDays', () => {
  it('does nothing when no day was missed', () => {
    const s = state({ lastActiveDate: '2026-11-22' });
    expect(settleMissedDays(s, '2026-11-22')).toBe(s);
  });

  it('spends a freeze per missed day, then resets when they run out', () => {
    const night1 = settleMissedDays(state({ freezes: 1 }), '2026-11-21');
    expect(night1).toMatchObject({ currentStreak: 3, freezes: 0, lastActiveDate: '2026-11-21' });
    expect(settleMissedDays(night1, '2026-11-22')).toMatchObject({ currentStreak: 0, freezes: 0 });
  });

  it('resets without spending freezes that cannot cover the gap', () => {
    expect(settleMissedDays(state({ freezes: 1 }), '2026-11-22')).toMatchObject({
      currentStreak: 0,
      freezes: 1,
    });
  });

  it('leaves a reset streak alone on later nights', () => {
    const reset = state({ currentStreak: 0 });
    expect(settleMissedDays(reset, '2026-12-25')).toBe(reset);
  });
});

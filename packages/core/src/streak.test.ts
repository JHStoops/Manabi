import {
  advanceStreak,
  declineFreezes,
  pendingFreezeSpend,
  settleMissedDays,
  spendFreezes,
} from './streak';
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

/** The local date `missed` days missed after 2026-11-20 (so the learner is on day 20 + missed + 1). */
const todayAfter = (missed: number) =>
  new Date(Date.UTC(2026, 10, 20 + missed + 1)).toISOString().slice(0, 10);

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
    // missed days, freezes held
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
    [3, 2],
  ])(
    'earning XP after %i missed days holding %i freezes restarts at 1 and keeps them',
    (missed, freezes) => {
      // Earning before answering the freeze offer counts as declining it.
      expect(advanceStreak(state({ freezes }), todayAfter(missed))).toMatchObject({
        currentStreak: 1,
        freezes,
        lastActiveDate: todayAfter(missed),
      });
    },
  );

  it('grants a freeze on every 7th day and holds at most 2', () => {
    const at6 = state({ currentStreak: 6, freezes: 0 });
    expect(advanceStreak(at6, '2026-11-21').freezes).toBe(1);
    expect(advanceStreak({ ...at6, freezes: 2 }, '2026-11-21').freezes).toBe(2);
    expect(advanceStreak({ ...at6, currentStreak: 5 }, '2026-11-21').freezes).toBe(0);
  });

  it('keeps the longest streak when it restarts', () => {
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
  });
});

describe('pendingFreezeSpend', () => {
  it.each([
    // missed days, freezes held, days offered
    [0, 2, null],
    [1, 0, null],
    [1, 1, 1],
    [1, 2, 1],
    [2, 1, null],
    [2, 2, 2],
    [3, 2, null],
  ])('%i missed days holding %i freezes offers %p', (missed, freezes, days) => {
    expect(pendingFreezeSpend(state({ freezes }), todayAfter(missed))).toEqual(
      days === null ? null : { days },
    );
  });

  it('offers nothing without a running streak', () => {
    expect(pendingFreezeSpend(state({ freezes: 2, currentStreak: 0 }), '2026-11-22')).toBeNull();
  });

  it('counts missed days across a daylight saving change', () => {
    const s = state({ freezes: 1, lastActiveDate: '2026-03-07' });
    expect(pendingFreezeSpend(s, '2026-03-09')).toEqual({ days: 1 });
  });
});

describe('spendFreezes and declineFreezes', () => {
  it('spends the offered freezes, keeps the streak and lets today extend it', () => {
    const spent = spendFreezes(state({ freezes: 2 }), todayAfter(2));
    expect(spent).toMatchObject({ currentStreak: 3, freezes: 0, lastActiveDate: '2026-11-22' });
    expect(advanceStreak(spent, todayAfter(2)).currentStreak).toBe(4);
  });

  it('does nothing when no offer is open', () => {
    const s = state({ freezes: 1 });
    expect(spendFreezes(s, todayAfter(2))).toBe(s);
  });

  it('declining resets the streak and keeps the freezes', () => {
    expect(declineFreezes(state({ freezes: 2 }))).toMatchObject({ currentStreak: 0, freezes: 2 });
  });
});

describe('settleMissedDays', () => {
  it('never spends freezes and leaves a streak within the cover alone', () => {
    const s = state({ freezes: 2 });
    expect(settleMissedDays(s, todayAfter(0))).toBe(s);
    expect(settleMissedDays(s, todayAfter(2))).toBe(s);
  });

  it('resets once the missed days exceed the freezes held, keeping them', () => {
    expect(settleMissedDays(state({ freezes: 1 }), todayAfter(2))).toMatchObject({
      currentStreak: 0,
      freezes: 1,
    });
    expect(settleMissedDays(state({ freezes: 0 }), todayAfter(1))).toMatchObject({
      currentStreak: 0,
      freezes: 0,
    });
  });

  it('gives the same result however many runs were missed or repeated', () => {
    const s = state({ freezes: 1 });
    const direct = settleMissedDays(s, todayAfter(4));
    const nightly = [1, 2, 3, 4].reduce((acc, m) => settleMissedDays(acc, todayAfter(m)), s);
    expect(nightly).toEqual(direct);
    expect(settleMissedDays(direct, todayAfter(4))).toEqual(direct);
    expect(settleMissedDays(direct, todayAfter(9))).toEqual(direct);
  });
});

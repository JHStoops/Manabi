import { combineFacets, DEFAULT_SRS_INTERVAL_HOURS, FixedLadderScheduler } from './srs';
import type { Stage } from './progress';

const NOW = new Date('2026-01-01T00:00:00Z');
const HOUR = 3_600_000;
const scheduler = new FixedLadderScheduler();

describe('FixedLadderScheduler (FR-111, FR-112)', () => {
  it.each<[Stage, boolean, Stage, number | null]>([
    // stage, correct, next stage, hours until due
    [1, true, 2, 24],
    [2, true, 3, 72],
    [3, true, 4, 168],
    [4, true, 5, 336],
    [5, true, 6, 720],
    [6, true, 7, 2880],
    [7, true, 8, null],
    [1, false, 1, 4],
    [2, false, 1, 4],
    [3, false, 2, 24],
    [4, false, 3, 72],
    [5, false, 3, 72],
    [6, false, 4, 168],
    [7, false, 5, 336],
    [8, true, 8, null],
    [8, false, 8, null],
  ])('stage %i, correct %s -> stage %i due in %s hours', (stage, correct, nextStage, hours) => {
    expect(scheduler.next(stage, correct, NOW)).toEqual({
      stage: nextStage,
      dueAt: hours === null ? null : new Date(NOW.getTime() + hours * HOUR),
    });
  });

  it('uses the configured intervals, not built-in ones', () => {
    const hours = [...DEFAULT_SRS_INTERVAL_HOURS];
    hours[1] = 48;
    expect(new FixedLadderScheduler(hours).next(1, true, NOW).dueAt).toEqual(
      new Date(NOW.getTime() + 48 * HOUR),
    );
  });

  it.each([[[1, 2, 3]], [[4, 24, 72, 168, 336, 720, 0]]])('rejects interval table %j', (hours) => {
    expect(() => new FixedLadderScheduler(hours)).toThrow(/7 positive/);
  });
});

describe('combineFacets (FR-112)', () => {
  it.each<[(boolean | undefined)[], boolean | null]>([
    [[true], true],
    [[true, true, true], true],
    [[true, false, true], false],
    [[false, undefined], false],
    [[true, undefined], null],
    [[], null],
  ])('%j -> %s', (answers, outcome) => {
    expect(combineFacets(answers)).toBe(outcome);
  });
});

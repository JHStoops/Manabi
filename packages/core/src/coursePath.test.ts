import type { UnlockUnit } from './index';
import { coursePathQuerySchema, lessonStates } from './index';
import { describeSchema } from './testCases';

// FR-021, FR-232: the path unlock rules.

const t = (day: number) => new Date(Date.UTC(2026, 10, day));

/** A unit whose lessons were all added on day 1; `done[i]` is the day lesson i was completed. */
function unit(done: (number | null)[], testedOut = false): UnlockUnit {
  return {
    testedOut,
    lessons: done.map((day) => ({ completedAt: day === null ? null : t(day), addedAt: t(1) })),
  };
}

describe('lessonStates', () => {
  it('opens only the first lesson of a new learner', () => {
    expect(lessonStates([unit([null, null]), unit([null])])).toEqual([
      ['available', 'locked'],
      ['locked'],
    ]);
  });

  it('opens the next lesson mid-unit', () => {
    expect(lessonStates([unit([2, null, null])])).toEqual([['completed', 'available', 'locked']]);
  });

  it('opens the next unit only when every lesson of the previous one is completed', () => {
    expect(lessonStates([unit([2, null]), unit([null])])[1]).toEqual(['locked']);
    expect(lessonStates([unit([2, 3]), unit([null, null])])[1]).toEqual(['available', 'locked']);
  });

  it('crosses section boundaries the same way (units are in path order)', () => {
    expect(lessonStates([unit([2]), unit([3]), unit([null])])[2]).toEqual(['available']);
  });

  it('opens the next unit after a test-out, and every lesson of the tested-out unit', () => {
    expect(lessonStates([unit([null, null], true), unit([null])])).toEqual([
      ['available', 'available'],
      ['available'],
    ]);
  });

  it('shows a lesson added to a completed unit as available without re-locking the next unit', () => {
    const finished = unit([2, 3]);
    finished.lessons.push({ completedAt: null, addedAt: t(5) });
    expect(lessonStates([finished, unit([null])])).toEqual([
      ['completed', 'completed', 'available'],
      ['available'],
    ]);
  });

  it('shows a lesson inserted behind the learner as available', () => {
    expect(lessonStates([unit([2, null, 3, null])])).toEqual([
      ['completed', 'available', 'completed', 'available'],
    ]);
  });

  it('keeps a unit the learner has reached unlocked when an earlier unit gains a lesson', () => {
    // The new lesson predates the learner's last completion there, so unit 1 is not finished.
    expect(lessonStates([unit([2, null]), unit([4])])[1]).toEqual(['completed']);
    expect(lessonStates([unit([2, null]), unit([null, 4])])[1]).toEqual(['available', 'completed']);
  });

  it('counts a lesson added before the last completion against the unit', () => {
    const u = unit([2, null]);
    u.lessons.push({ completedAt: t(6), addedAt: t(5) });
    expect(lessonStates([u, unit([null])])[1]).toEqual(['locked']);
  });
});

describeSchema(
  'coursePathQuerySchema',
  coursePathQuerySchema,
  [
    ['no preview', {}],
    ['preview', { preview: 'true' }],
  ],
  [['a non-boolean preview', { preview: 'yes' }]],
);

import type { UnlockUnit } from './index';
import { coursePathQuerySchema, lessonStates } from './index';
import { describeSchema } from './testCases';

// FR-021, FR-232: the path unlock rules.

/** A unit whose lesson i is completed when `done[i]` is true. */
function unit(done: boolean[], extra: Partial<UnlockUnit> = {}): UnlockUnit {
  return {
    testedOut: false,
    completed: false,
    lessons: done.map((completed) => ({ completed })),
    ...extra,
  };
}

const T = true;
const F = false;

describe('lessonStates', () => {
  it('opens only the first lesson of a new learner', () => {
    expect(lessonStates([unit([F, F]), unit([F])])).toEqual([['available', 'locked'], ['locked']]);
  });

  it('opens the next lesson mid-unit', () => {
    expect(lessonStates([unit([T, F, F])])).toEqual([['completed', 'available', 'locked']]);
  });

  it('opens the next unit only when every lesson of the previous one is completed', () => {
    expect(lessonStates([unit([T, F]), unit([F])])[1]).toEqual(['locked']);
    expect(lessonStates([unit([T, T]), unit([F, F])])[1]).toEqual(['available', 'locked']);
  });

  it('crosses section boundaries the same way (units are in path order)', () => {
    expect(lessonStates([unit([T]), unit([T]), unit([F])])[2]).toEqual(['available']);
  });

  it('opens the next unit after a test-out, and every lesson of the tested-out unit', () => {
    expect(lessonStates([unit([F, F], { testedOut: true }), unit([F])])).toEqual([
      ['available', 'available'],
      ['available'],
    ]);
  });

  it('keeps the next unit open when lessons A and B are added to a completed unit and only A is done', () => {
    const finished = unit([T, T, T, F], { completed: true });
    expect(lessonStates([finished, unit([F])])).toEqual([
      ['completed', 'completed', 'completed', 'available'],
      ['available'],
    ]);
  });

  it('shows a lesson added to a completed unit as available', () => {
    expect(lessonStates([unit([T, T, F], { completed: true }), unit([F])])[0]).toEqual([
      'completed',
      'completed',
      'available',
    ]);
  });

  it('shows a lesson inserted behind the learner as available', () => {
    expect(lessonStates([unit([T, F, T, F])])).toEqual([
      ['completed', 'available', 'completed', 'available'],
    ]);
  });

  it('keeps a unit the learner has reached unlocked when an earlier unit gains a lesson', () => {
    expect(lessonStates([unit([T, F]), unit([T])])[1]).toEqual(['completed']);
    expect(lessonStates([unit([T, F]), unit([F, T])])[1]).toEqual(['available', 'completed']);
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

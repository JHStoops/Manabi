import type { ExerciseTypeDefinition } from './index';
import {
  getExerciseType,
  gradeResponse,
  registerExerciseType,
  UnknownExerciseTypeError,
  z,
} from './index';
import { TEST_EXERCISE_TYPE, testExercise, testPlugin } from './testExerciseType';

const grade = (...attempts: unknown[]) => gradeResponse(testExercise, { attempts }, testPlugin);

describe('exercise registry', () => {
  const definition: ExerciseTypeDefinition = {
    id: 'other',
    payloadSchema: z.unknown(),
    answerSchema: z.unknown(),
    grade: () => ({ result: 'correct' }),
  };

  it('looks definitions up by type id', () => {
    registerExerciseType(definition);
    expect(getExerciseType('other')).toBe(definition);
    expect(getExerciseType(TEST_EXERCISE_TYPE).id).toBe(TEST_EXERCISE_TYPE);
  });

  it('throws for an unknown type id', () => {
    expect(() => getExerciseType('nope')).toThrow(UnknownExerciseTypeError);
    expect(() => getExerciseType('nope')).toThrow('Unknown exercise type "nope"');
  });

  it.each([
    ['a malformed id', { ...definition, id: 'Echo-1' }, 'Invalid exercise type id "Echo-1"'],
    ['a duplicate id', { ...definition, id: TEST_EXERCISE_TYPE }, 'registered twice'],
  ])('rejects %s', (_label, bad, message) => {
    expect(() => registerExerciseType(bad)).toThrow(message);
  });
});

describe('gradeResponse', () => {
  it('grades one attempt: correct, near-miss with a hint, or wrong with feedback', () => {
    expect(grade('Water')).toEqual({ result: 'correct' });
    expect(grade('water')).toEqual({ result: 'near-miss', hint: 'Watch your capitals' });
    expect(grade('fire')).toEqual({ result: 'wrong', feedback: 'Water' });
  });

  it('decides on the second attempt after a wrong first one (FR-046)', () => {
    expect(grade('fire', 'Water')).toEqual({ result: 'correct' });
    expect(grade('fire', 'ice')).toEqual({ result: 'wrong', feedback: 'Water' });
  });

  it('rejects a second attempt after a first that was not wrong', () => {
    expect(() => grade('Water', 'fire')).toThrow('only allowed after a wrong first answer');
    expect(() => grade('water', 'Water')).toThrow('only allowed after a wrong first answer');
  });

  it('rejects an invalid payload, answer or attempt count', () => {
    const badPayload = { ...testExercise, payload: { prompt: 'x', answer: '' } };
    expect(() => gradeResponse(badPayload, { attempts: ['x'] }, testPlugin)).toThrow(z.ZodError);
    expect(() => grade(1)).toThrow(z.ZodError);
    expect(() => grade()).toThrow(z.ZodError);
    expect(() => grade('a', 'b', 'c')).toThrow(z.ZodError);
  });

  it('throws for an unregistered type', () => {
    expect(() =>
      gradeResponse({ type: 'nope', payload: {} }, { attempts: ['x'] }, testPlugin),
    ).toThrow(UnknownExerciseTypeError);
  });
});

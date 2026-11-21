import { gradeResponse } from '@manabi/core';
import { testExercise, testPlugin } from '@manabi/core/src/testExerciseType';

// FR-053: the server re-grades with the same gradeResponse the web app runs.
describe('shared exercise grading', () => {
  it('re-grades a response with the core grader', () => {
    expect(gradeResponse(testExercise, { attempts: ['fire', 'Water'] }, testPlugin)).toEqual({
      result: 'correct',
    });
  });
});

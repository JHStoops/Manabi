import { z } from 'zod';
import type { Exercise } from './exerciseRegistry';
import { registerExerciseType } from './exerciseRegistry';
import type { LanguagePlugin } from './languagePlugin';
import type { AnswerText } from './sentence';

// Test code only, not exported from the package: a dummy exercise type that proves the extension
// path end to end (core registry, shared grader, web renderer). Importing this file registers it.

export const TEST_EXERCISE_TYPE = 'test_echo';

registerExerciseType({
  id: TEST_EXERCISE_TYPE,
  payloadSchema: z.object({ prompt: z.string(), answer: z.string().min(1) }),
  answerSchema: z.string(),
  grade: (payload, answer, plugin) => {
    const check = plugin.checkAnswer(answer, [{ text: payload.answer, tiles: [] }], false);
    return check.result === 'wrong' ? { ...check, feedback: payload.answer } : check;
  },
});

/** A test plugin: exact match is correct, a match ignoring case is a near-miss. */
export const testPlugin = {
  checkAnswer: (given: string, accept: readonly AnswerText[]) => {
    const answer = accept[0]!.text;
    if (given === answer) return { result: 'correct' };
    if (given.toLowerCase() === answer.toLowerCase()) {
      return { result: 'near-miss', hint: 'Watch your capitals' };
    }
    return { result: 'wrong' };
  },
} as unknown as LanguagePlugin;

export const testExercise: Exercise = {
  type: TEST_EXERCISE_TYPE,
  payload: { prompt: 'Type "Water"', answer: 'Water' },
};

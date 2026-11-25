import type { z } from 'zod';
import { registerExerciseType } from '../exerciseRegistry';
import { nonEmptyTextSchema } from '../primitives';
import { answerCheckPayloadSchema } from '../sentence';
import { typedAnswerAnswerSchema } from './typed_answer';

/**
 * EX-10 conjugate (FR-043): type a requested form of a word (for example the te-form of a verb);
 * checked by the plugin against the authored accept list, kana or kanji (FR-143).
 */
export const CONJUGATE_TYPE = 'conjugate';

export const conjugatePayloadSchema = answerCheckPayloadSchema
  .extend({
    /** The form asked for, e.g. "Te-form". */
    prompt: nonEmptyTextSchema,
    /** The word to conjugate, in its dictionary form. */
    word: nonEmptyTextSchema,
  })
  .strict();
export type ConjugatePayload = z.infer<typeof conjugatePayloadSchema>;

registerExerciseType({
  id: CONJUGATE_TYPE,
  payloadSchema: conjugatePayloadSchema,
  answerSchema: typedAnswerAnswerSchema,
  grade: (payload, answer, plugin) => {
    const check = plugin.checkAnswer(answer, payload.accept, payload.testsKanji ?? false);
    return check.result === 'wrong' ? { ...check, feedback: payload.accept[0]!.text } : check;
  },
});

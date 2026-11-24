import { z } from 'zod';
import { registerExerciseType } from '../exerciseRegistry';
import { nonEmptyTextSchema } from '../primitives';
import { answerCheckPayloadSchema } from '../sentence';

/**
 * EX-04 typed answer (FR-042, FR-143): type a meaning in the base language (English) or a reading
 * in the target language (kana); checked by the plugin against the normalized accept list.
 */
export const TYPED_ANSWER_TYPE = 'typed_answer';

export const typedAnswerPayloadSchema = answerCheckPayloadSchema
  .extend({
    prompt: nonEmptyTextSchema,
    /** `target`: answered in the course language, with romaji-to-kana input (FR-142). */
    answerLanguage: z.enum(['target', 'base']),
  })
  .strict();
export type TypedAnswerPayload = z.infer<typeof typedAnswerPayloadSchema>;

/** The text the learner typed. */
export const typedAnswerAnswerSchema = z.string();

registerExerciseType({
  id: TYPED_ANSWER_TYPE,
  payloadSchema: typedAnswerPayloadSchema,
  answerSchema: typedAnswerAnswerSchema,
  grade: (payload, answer, plugin) => {
    const check = plugin.checkAnswer(answer, payload.accept, payload.testsKanji ?? false);
    return check.result === 'wrong' ? { ...check, feedback: payload.accept[0]!.text } : check;
  },
});

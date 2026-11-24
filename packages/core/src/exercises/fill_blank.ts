import { z } from 'zod';
import { registerExerciseType } from '../exerciseRegistry';
import { nonEmptyTextSchema } from '../primitives';
import { answerCheckPayloadSchema } from '../sentence';

/**
 * EX-05 fill the blank (FR-042): choose or type the missing particle or word in a sentence;
 * checked by the plugin against the accept list (FR-143, FR-240).
 */
export const FILL_BLANK_TYPE = 'fill_blank';

export const fillBlankPayloadSchema = answerCheckPayloadSchema
  .extend({
    /** What the sentence means, shown above it. */
    prompt: nonEmptyTextSchema,
    /** The sentence around the blank; either side may be empty. */
    before: z.string(),
    after: z.string(),
    /**
     * Options to choose from, in display order; absent when the learner types the blank. Choices
     * are graded by `checkAnswer` like typed text, so unless `testsKanji` is set, a distractor
     * that is the kana spelling of a kanji answer counts as correct: do not author one.
     */
    options: z.array(nonEmptyTextSchema).min(2).max(4).optional(),
  })
  .strict()
  .refine((p) => !p.options || new Set(p.options).size === p.options.length, {
    message: 'Options must be distinct',
    path: ['options'],
  })
  .refine((p) => !p.options || p.options.some((o) => p.accept.some((a) => a.text === o)), {
    message: 'One option must be an accepted answer',
    path: ['options'],
  });
export type FillBlankPayload = z.infer<typeof fillBlankPayloadSchema>;

/** The text chosen or typed into the blank. */
export const fillBlankAnswerSchema = z.string();

registerExerciseType({
  id: FILL_BLANK_TYPE,
  payloadSchema: fillBlankPayloadSchema,
  answerSchema: fillBlankAnswerSchema,
  grade: (payload, answer, plugin) => {
    const check = plugin.checkAnswer(answer, payload.accept, payload.testsKanji ?? false);
    return check.result === 'wrong' ? { ...check, feedback: payload.accept[0]!.text } : check;
  },
});

import { z } from 'zod';
import { registerExerciseType } from '../exerciseRegistry';
import { idSchema, nonEmptyTextSchema } from '../primitives';

/** EX-01 multiple choice (FR-042): pick the meaning, reading or item from 4 options; exact. */
export const CHOICE_TYPE = 'choice';

export const choicePayloadSchema = z
  .object({
    prompt: nonEmptyTextSchema,
    /** Shown in this order, so the number shortcuts match it; whoever builds the payload shuffles. */
    options: z
      .array(
        z.object({ text: nonEmptyTextSchema, itemId: idSchema.nullable().optional() }).strict(),
      )
      .length(4),
    /** Index of the correct option. */
    correct: z.number().int().min(0).max(3),
  })
  .strict()
  .refine((p) => new Set(p.options.map((o) => o.text)).size === p.options.length, {
    message: 'Option texts must be distinct',
    path: ['options'],
  });
export type ChoicePayload = z.infer<typeof choicePayloadSchema>;

/** The index of the chosen option. */
export const choiceAnswerSchema = z.number().int().min(0).max(3);

registerExerciseType({
  id: CHOICE_TYPE,
  payloadSchema: choicePayloadSchema,
  answerSchema: choiceAnswerSchema,
  grade: (payload, answer) =>
    answer === payload.correct
      ? { result: 'correct' }
      : { result: 'wrong', feedback: payload.options[payload.correct]!.text },
});

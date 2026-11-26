import { z } from 'zod';
import { registerExerciseType } from '../exerciseRegistry';
import { idSchema, nonEmptyTextSchema } from '../primitives';

/**
 * EX-09 reading in context (FR-043): pick the right reading of a kanji inside a given word from 2
 * to 4 options; exact.
 */
export const READING_IN_CONTEXT_TYPE = 'reading_in_context';

const textRefSchema = z
  .object({ text: nonEmptyTextSchema, itemId: idSchema.nullable().optional() })
  .strict();

export const readingInContextPayloadSchema = z
  .object({
    prompt: nonEmptyTextSchema,
    /** The word shown, with `kanji` highlighted in it. */
    word: textRefSchema,
    kanji: textRefSchema,
    /** Readings, shown in this order; whoever builds the payload shuffles. */
    options: z
      .array(z.object({ text: nonEmptyTextSchema }).strict())
      .min(2)
      .max(4),
    /** Index of the correct option. */
    correct: z.number().int().min(0),
  })
  .strict()
  .refine((p) => p.word.text.includes(p.kanji.text), {
    message: 'The kanji must appear in the word',
    path: ['kanji'],
  })
  .refine((p) => p.correct < p.options.length, {
    message: 'Correct must index an option',
    path: ['correct'],
  })
  .refine((p) => new Set(p.options.map((o) => o.text)).size === p.options.length, {
    message: 'Option texts must be distinct',
    path: ['options'],
  });
export type ReadingInContextPayload = z.infer<typeof readingInContextPayloadSchema>;

/** The index of the chosen option. */
export const readingInContextAnswerSchema = z.number().int().min(0).max(3);

registerExerciseType({
  id: READING_IN_CONTEXT_TYPE,
  payloadSchema: readingInContextPayloadSchema,
  answerSchema: readingInContextAnswerSchema,
  grade: (payload, answer) =>
    answer === payload.correct
      ? { result: 'correct' }
      : { result: 'wrong', feedback: payload.options[payload.correct]!.text },
});

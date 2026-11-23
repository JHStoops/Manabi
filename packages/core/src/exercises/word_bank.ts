import { z } from 'zod';
import { registerExerciseType } from '../exerciseRegistry';
import { nonEmptyTextSchema } from '../primitives';
import { answerTextSchema, tileSchema } from '../sentence';

/**
 * EX-03 word bank (FR-042): build a translation by tapping tiles in order; any accepted tile
 * order is correct. Whoever builds the payload takes the answer's tiles from the language
 * plugin's `tokenize` (FR-240), which returns the tiles stored with the text (DR-12).
 */
export const WORD_BANK_TYPE = 'word_bank';

export const wordBankPayloadSchema = z
  .object({
    /** The text to translate. */
    prompt: nonEmptyTextSchema,
    /** DR-12: the answer text with its tiles. */
    answer: answerTextSchema.extend({ tiles: answerTextSchema.shape.tiles.min(1) }),
    /** Extra tiles in the bank that belong to no accepted order. */
    distractors: z.array(tileSchema),
    /** Each accepted order as distinct indexes into `answer.tiles`. */
    acceptedOrders: z.array(z.array(z.number().int().min(0)).min(1)).min(1),
  })
  .strict()
  .refine(
    (p) =>
      p.acceptedOrders.every(
        (order) =>
          new Set(order).size === order.length && order.every((i) => i < p.answer.tiles.length),
      ),
    { message: 'Each accepted order lists distinct answer tile indexes', path: ['acceptedOrders'] },
  );
export type WordBankPayload = z.infer<typeof wordBankPayloadSchema>;

/** The tiles the learner placed, in order, as indexes into `[...answer.tiles, ...distractors]`. */
export const wordBankAnswerSchema = z.array(z.number().int().min(0));

registerExerciseType({
  id: WORD_BANK_TYPE,
  payloadSchema: wordBankPayloadSchema,
  answerSchema: wordBankAnswerSchema,
  grade: (payload, answer) => {
    const bank = [...payload.answer.tiles, ...payload.distractors];
    // Compared by surface, so tiles with the same text are interchangeable.
    const surfaces = (order: number[]) => JSON.stringify(order.map((i) => bank[i]?.surface));
    const valid = new Set(answer).size === answer.length && answer.every((i) => i < bank.length);
    return valid && payload.acceptedOrders.some((order) => surfaces(order) === surfaces(answer))
      ? { result: 'correct' }
      : { result: 'wrong', feedback: payload.answer.text };
  },
});

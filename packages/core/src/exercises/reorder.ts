import { z } from 'zod';
import { registerExerciseType } from '../exerciseRegistry';
import { nonEmptyTextSchema } from '../primitives';
import { answerTextSchema } from '../sentence';

/**
 * EX-06 reorder (FR-042): drag the sentence's chunks into order; any accepted order is correct.
 * Whoever builds the payload takes the chunks from the language plugin's `tokenize` (FR-240),
 * which returns the tiles stored with the sentence (DR-12).
 */
export const REORDER_TYPE = 'reorder';

function isPermutation(order: number[], length: number): boolean {
  return (
    order.length === length && new Set(order).size === length && order.every((i) => i < length)
  );
}

export const reorderPayloadSchema = z
  .object({
    /** What the sentence means. */
    prompt: nonEmptyTextSchema,
    /** DR-12: the sentence with its tiles, which are the chunks to order. */
    answer: answerTextSchema.extend({ tiles: answerTextSchema.shape.tiles.min(2) }),
    /** Each accepted order as a permutation of the indexes into `answer.tiles`. */
    acceptedOrders: z.array(z.array(z.number().int().min(0))).min(1),
  })
  .strict()
  .refine((p) => p.acceptedOrders.every((order) => isPermutation(order, p.answer.tiles.length)), {
    message: 'Each accepted order lists every answer tile index once',
    path: ['acceptedOrders'],
  });
export type ReorderPayload = z.infer<typeof reorderPayloadSchema>;

/** The chunks in the learner's order, as indexes into `answer.tiles`. */
export const reorderAnswerSchema = z.array(z.number().int().min(0));

registerExerciseType({
  id: REORDER_TYPE,
  payloadSchema: reorderPayloadSchema,
  answerSchema: reorderAnswerSchema,
  grade: (payload, answer) => {
    const { tiles } = payload.answer;
    // Compared by surface, so chunks with the same text are interchangeable.
    const surfaces = (order: number[]) => JSON.stringify(order.map((i) => tiles[i]!.surface));
    return isPermutation(answer, tiles.length) &&
      payload.acceptedOrders.some((order) => surfaces(order) === surfaces(answer))
      ? { result: 'correct' }
      : { result: 'wrong', feedback: payload.answer.text };
  },
});

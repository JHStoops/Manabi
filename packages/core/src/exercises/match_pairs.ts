import { z } from 'zod';
import { registerExerciseType } from '../exerciseRegistry';
import { idSchema, nonEmptyTextSchema } from '../primitives';

/** EX-02 match pairs (FR-042): pair 5 items with their meanings or readings; exact. */
export const MATCH_PAIRS_TYPE = 'match_pairs';

const distinct = (texts: string[]) => new Set(texts).size === texts.length;

export const matchPairsPayloadSchema = z
  .object({
    /** Terms are shown in this order and matches shuffled. */
    pairs: z
      .array(
        z
          .object({
            term: nonEmptyTextSchema,
            match: nonEmptyTextSchema,
            itemId: idSchema.nullable().optional(),
          })
          .strict(),
      )
      .length(5),
  })
  .strict()
  .refine((p) => distinct(p.pairs.map((pair) => pair.term)), {
    message: 'Terms must be distinct',
    path: ['pairs'],
  })
  .refine((p) => distinct(p.pairs.map((pair) => pair.match)), {
    message: 'Matches must be distinct',
    path: ['pairs'],
  });
export type MatchPairsPayload = z.infer<typeof matchPairsPayloadSchema>;

/**
 * For each pair's term, in order, the index of the pair whose match the learner joined it to.
 * Wrong pairings are retried inside the exercise (Product Spec section 4), so the renderer only
 * reports the finished board.
 */
export const matchPairsAnswerSchema = z.array(z.number().int().min(0)).length(5);

registerExerciseType({
  id: MATCH_PAIRS_TYPE,
  payloadSchema: matchPairsPayloadSchema,
  answerSchema: matchPairsAnswerSchema,
  grade: (_payload, answer) => ({
    result: answer.every((match, term) => match === term) ? 'correct' : 'wrong',
  }),
});

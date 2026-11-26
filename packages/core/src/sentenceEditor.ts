import { z } from 'zod';
import {
  idParamSchema,
  idSchema,
  levelCodeSchema,
  nonEmptyTextSchema,
  stableKeySchema,
} from './primitives';
import { reviewStatusSchema, sentenceSchema, tileSchema } from './sentence';

/**
 * The sentence editor, `/authoring/sentences` (FR-059, FR-236, FR-237, FR-238, DR-11, Product
 * Spec section 11). Admin only. The server segments text and detects grammar; the editor fixes
 * tiles, review status and the challenge status.
 */

export const authoringSentenceIdParamsSchema = z.object({ id: idParamSchema });

/** `GET /authoring/sentences`: a course's active sentences, filtered. */
export const authoringSentenceQuerySchema = z.object({
  course: idParamSchema,
  status: reviewStatusSchema.optional(),
  /** Sentences in which this grammar point was detected: the point's examples. */
  grammar: stableKeySchema.optional(),
  /** Text or translation contains this. */
  q: z.string().max(200).optional(),
});

/** FR-059: challenge status, derived from the levels unless `sentence.challengeOverride` is set. */
const challengingSchema = z.boolean();

export const authoringSentenceSummarySchema = z.object({
  id: idSchema,
  text: nonEmptyTextSchema,
  translation: nonEmptyTextSchema,
  reviewStatus: reviewStatusSchema,
  grammarLevelCode: levelCodeSchema.nullable(),
  challenging: challengingSchema,
});
export type AuthoringSentenceSummary = z.infer<typeof authoringSentenceSummarySchema>;

export const authoringSentenceListSchema = z.object({
  sentences: z.array(authoringSentenceSummarySchema),
});

/** One sentence as the editor sees it. FR-237: blocklist words in its tiles, as a warning. */
export const authoringSentenceSchema = z.object({
  sentence: sentenceSchema,
  challenging: challengingSchema,
  blockedWords: z.array(nonEmptyTextSchema),
});
export type AuthoringSentence = z.infer<typeof authoringSentenceSchema>;

/** `POST /authoring/sentences`: a new authored sentence, segmented on the server (FR-238). */
export const createSentenceRequestSchema = z.object({
  course: idSchema,
  text: nonEmptyTextSchema,
  translation: nonEmptyTextSchema,
});
export type CreateSentenceRequest = z.infer<typeof createSentenceRequestSchema>;

/**
 * `PATCH /authoring/sentences/:id`. Fields left out keep their value. `tiles`: the author's tiles,
 * whose surfaces must appear in the text in order. `resegment`: replace the tiles with the
 * server's segmentation of the text instead. A text change reruns grammar detection (FR-236).
 * `challengeOverride` null goes back to the derived status (FR-059).
 */
export const updateSentenceRequestSchema = z
  .object({
    text: nonEmptyTextSchema.optional(),
    translation: nonEmptyTextSchema.optional(),
    tiles: z.array(tileSchema).min(1).max(100).optional(),
    resegment: z.boolean().optional(),
    reviewStatus: reviewStatusSchema.optional(),
    challengeOverride: z.boolean().nullable().optional(),
  })
  .refine((b) => !(b.tiles && b.resegment), {
    message: 'Send tiles or resegment, not both',
    path: ['resegment'],
  });
export type UpdateSentenceRequest = z.infer<typeof updateSentenceRequestSchema>;

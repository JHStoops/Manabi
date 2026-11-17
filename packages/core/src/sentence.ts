import { z } from 'zod';
import {
  idSchema,
  levelCodeSchema,
  nonEmptyTextSchema,
  stableKeySchema,
  timestampSchema,
} from './primitives';

/**
 * DR-12: one stored tile. Sentences keep their tiles in `sentences.tokens`, and authored exercise
 * answer text keeps them, in this same shape, inside the exercise payload. `itemId` links the
 * tile to a course item where one is known. Punctuation is not a tile, so every field is
 * non-empty.
 */
export const tileSchema = z
  .object({
    surface: nonEmptyTextSchema,
    base: nonEmptyTextSchema,
    reading: nonEmptyTextSchema,
    itemId: idSchema.nullable().optional(),
  })
  .strict();
export type Tile = z.infer<typeof tileSchema>;

/** DR-12: authored answer text together with its tiles, as stored in an exercise payload. */
export const answerTextSchema = z
  .object({
    text: nonEmptyTextSchema,
    tiles: z.array(tileSchema),
  })
  .strict();
export type AnswerText = z.infer<typeof answerTextSchema>;

/** Every accepted answer of a typed exercise, each with its tiles. Authors extend it (FR-229). */
export const acceptListSchema = z.array(answerTextSchema).min(1);
export type AcceptList = z.infer<typeof acceptListSchema>;

/** DR-12: sentence review status. */
export const reviewStatusSchema = z.enum(['unreviewed', 'flagged', 'reviewed']);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

/** DR-11: attribution for one side (sentence or translation) of an imported pair. */
export const attributionPartSchema = z
  .object({
    sourceId: nonEmptyTextSchema,
    /** The contributor's username in the source dataset, or null when it has none. */
    owner: nonEmptyTextSchema.nullable(),
    url: z.string().url(),
    licence: nonEmptyTextSchema,
    datasetVersion: nonEmptyTextSchema,
  })
  .strict();
export type AttributionPart = z.infer<typeof attributionPartSchema>;

/**
 * DR-11: the `sentences.attribution` JSONB, kept separately for the sentence and translation.
 * `otherTranslationIds`: the source's other direct translations, for the author to choose from.
 */
export const sentenceAttributionSchema = z
  .object({
    sentence: attributionPartSchema,
    translation: attributionPartSchema,
    otherTranslationIds: z.array(nonEmptyTextSchema).optional(),
  })
  .strict();
export type SentenceAttribution = z.infer<typeof sentenceAttributionSchema>;

/**
 * A sentence (DR-11, DR-12, DR-13). `grammar` lists the keys of grammar points detected at
 * import. `vocabLevelCode` is the highest level among its content words and `grammarLevelCode`
 * the highest among its detected grammar points; either is null when there is none.
 * `challengeOverride` is null when the challenge status is derived from the two levels.
 */
export const sentenceSchema = z
  .object({
    id: idSchema,
    courseId: idSchema,
    text: nonEmptyTextSchema,
    tokens: z.array(tileSchema),
    translation: nonEmptyTextSchema,
    source: nonEmptyTextSchema.nullable(),
    sourceId: nonEmptyTextSchema.nullable(),
    attribution: sentenceAttributionSchema.nullable(),
    reviewStatus: reviewStatusSchema,
    grammar: z.array(stableKeySchema),
    vocabLevelCode: levelCodeSchema.nullable(),
    grammarLevelCode: levelCodeSchema.nullable(),
    challengeOverride: z.boolean().nullable(),
    edited: z.boolean(),
    translationEdited: z.boolean(),
    tokensEdited: z.boolean(),
    archivedAt: timestampSchema.nullable(),
  })
  .refine((s) => (s.source === null) === (s.sourceId === null), {
    message: 'source and sourceId are set together',
    path: ['sourceId'],
  })
  .refine((s) => s.source === null || s.attribution !== null, {
    message: 'An imported sentence needs attribution',
    path: ['attribution'],
  });
export type Sentence = z.infer<typeof sentenceSchema>;

import { z } from 'zod';
import {
  idParamSchema,
  idSchema,
  langCodeSchema,
  levelCodeSchema,
  nonEmptyTextSchema,
  stableKeySchema,
} from './primitives';

/** Request and response bodies of `/authoring/word-lists` (FR-234, FR-237). */

export const wordListIdParamsSchema = z.object({ id: idParamSchema });

/** FR-234: a supplementary common word, treated as a level-list word at `level`. */
export const supplementaryWordSchema = z.object({
  id: idSchema,
  course: stableKeySchema,
  level: levelCodeSchema,
  written: nonEmptyTextSchema,
  reading: nonEmptyTextSchema,
  note: nonEmptyTextSchema.nullable(),
});
export type SupplementaryWord = z.infer<typeof supplementaryWordSchema>;

export const supplementaryWordListSchema = z.object({ words: z.array(supplementaryWordSchema) });

export const supplementaryWordQuerySchema = z.object({
  course: stableKeySchema.optional(),
  level: levelCodeSchema.optional(),
});

export const createSupplementaryWordRequestSchema = z.object({
  course: stableKeySchema,
  level: levelCodeSchema,
  written: nonEmptyTextSchema,
  reading: nonEmptyTextSchema,
  note: nonEmptyTextSchema.optional(),
});
export type CreateSupplementaryWordRequest = z.infer<typeof createSupplementaryWordRequestSchema>;

/** `note: null` clears the note. */
export const updateSupplementaryWordRequestSchema = z
  .object({
    level: levelCodeSchema.optional(),
    written: nonEmptyTextSchema.optional(),
    reading: nonEmptyTextSchema.optional(),
    note: nonEmptyTextSchema.nullable().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), 'Nothing to change');
export type UpdateSupplementaryWordRequest = z.infer<typeof updateSupplementaryWordRequestSchema>;

/** FR-237: a blocked word of a language. */
export const blockedWordSchema = z.object({
  id: idSchema,
  lang: langCodeSchema,
  word: nonEmptyTextSchema,
});
export type BlockedWord = z.infer<typeof blockedWordSchema>;

export const blockedWordListSchema = z.object({ words: z.array(blockedWordSchema) });

export const blockedWordQuerySchema = z.object({ lang: langCodeSchema.optional() });

export const createBlockedWordRequestSchema = z.object({
  lang: langCodeSchema,
  word: nonEmptyTextSchema,
});
export type CreateBlockedWordRequest = z.infer<typeof createBlockedWordRequestSchema>;

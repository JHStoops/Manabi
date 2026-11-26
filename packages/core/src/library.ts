import { z } from 'zod';
import { pageSchema, paginationQuerySchema } from './pagination';
import {
  idSchema,
  jsonObjectSchema,
  levelCodeSchema,
  stableKeySchema,
  timestampSchema,
  typeIdSchema,
} from './primitives';
import { stageSchema } from './progress';
import { itemLinkKindSchema } from './content';
import { sentenceAttributionSchema, tileSchema } from './sentence';

/** Library: item lists and item detail (FR-075, FR-092, FR-102; SDD section 8). */

/** Stage bands of the library's stage filter, named as in the ladder (Product Spec section 7). */
export const STAGE_BANDS = {
  not_started: null,
  learning: [1, 3],
  familiar: [4, 5],
  strong: [6, 6],
  mastered: [7, 7],
  retired: [8, 8],
} as const;
export const stageBandSchema = z.enum(
  Object.keys(STAGE_BANDS) as [keyof typeof STAGE_BANDS, ...(keyof typeof STAGE_BANDS)[]],
);
export type StageBand = z.infer<typeof stageBandSchema>;

/** `GET /items`: filters and search over one course's items. */
export const libraryItemsQuerySchema = paginationQuerySchema.extend({
  courseId: z.coerce.number().int().positive(),
  type: typeIdSchema.optional(),
  level: levelCodeSchema.optional(),
  strokeCount: z.coerce.number().int().min(1).max(100).optional(),
  radical: z.string().min(1).max(8).optional(),
  stage: stageBandSchema.optional(),
  /** Character, meaning, reading or pattern; folded by the course plugin's `searchKey`. */
  q: z.string().trim().min(1).max(100).optional(),
});
export type LibraryItemsQuery = z.infer<typeof libraryItemsQuerySchema>;

/** An item as a library tile shows it. */
export const libraryItemSchema = z.object({
  id: idSchema,
  key: stableKeySchema,
  type: typeIdSchema,
  levelCode: levelCodeSchema.nullable(),
  /** Imported data with author overrides applied (DR-09). */
  data: jsonObjectSchema,
  /** FR-102: the learner's lowest facet stage; null when the item is not started. */
  stage: stageSchema.nullable(),
});
export type LibraryItem = z.infer<typeof libraryItemSchema>;

export const libraryItemPageSchema = pageSchema(libraryItemSchema);
export type LibraryItemPage = z.infer<typeof libraryItemPageSchema>;

export const libraryItemKeyParamsSchema = z.object({ key: stableKeySchema });

/** `GET /items/:key`: the item, the learner's facets, linked items and example sentences. */
export const libraryItemDetailSchema = libraryItemSchema.extend({
  facets: z.array(
    z.object({ facet: typeIdSchema, stage: stageSchema, dueAt: timestampSchema.nullable() }),
  ),
  /** `outgoing`: this item links to it (a word's kanji); `incoming`: it links here. */
  links: z.array(
    z.object({
      kind: itemLinkKindSchema,
      direction: z.enum(['outgoing', 'incoming']),
      item: libraryItemSchema,
    }),
  ),
  /** Up to 5 sentences using the item or a word that contains it; reviewed first, then shortest. */
  sentences: z.array(
    z.object({
      id: idSchema,
      text: z.string(),
      translation: z.string(),
      tokens: z.array(tileSchema),
      attribution: sentenceAttributionSchema.nullable(),
    }),
  ),
});
export type LibraryItemDetail = z.infer<typeof libraryItemDetailSchema>;

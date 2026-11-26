import { z } from 'zod';
import type { ZodTypeAny } from 'zod';
import {
  idParamSchema,
  idSchema,
  jsonObjectSchema,
  levelCodeSchema,
  nonEmptyTextSchema,
  stableKeySchema,
  typeIdSchema,
} from './primitives';

/**
 * The item editor, `/authoring/items` (FR-221, DR-06, DR-09, SDD section 10). Admin only. Author
 * edits are stored as `overrides`, apart from the imported `data`, and win field by field when
 * the item is read, so re-running an importer never loses them.
 */

/** How the editor shows a field: one line, a number, one text per line, or JSON for the rest. */
export const itemFieldKindSchema = z.enum(['text', 'number', 'textList', 'json']);
export type ItemFieldKind = z.infer<typeof itemFieldKindSchema>;

export const itemFieldSchema = z.object({
  name: z.string(),
  kind: itemFieldKindSchema,
  optional: z.boolean(),
});
export type ItemField = z.infer<typeof itemFieldSchema>;

function itemField(name: string, schema: ZodTypeAny): ItemField {
  let s = schema;
  let optional = false;
  while (s instanceof z.ZodOptional || s instanceof z.ZodDefault) {
    optional = true;
    s = s.unwrap() as ZodTypeAny;
  }
  const kind: ItemFieldKind =
    s instanceof z.ZodString || s instanceof z.ZodEnum
      ? 'text'
      : s instanceof z.ZodNumber
        ? 'number'
        : s instanceof z.ZodArray && s.element instanceof z.ZodString
          ? 'textList'
          : 'json';
  return { name, kind, optional };
}

/** The editor's form fields, from the top-level fields of a plugin's item schema (DR-06). */
export function itemFields(schema: ZodTypeAny): ItemField[] {
  if (!(schema instanceof z.ZodObject)) return [];
  return Object.entries(schema.shape as Record<string, ZodTypeAny>).map(([name, s]) =>
    itemField(name, s),
  );
}

export const authoringItemIdParamsSchema = z.object({ id: idParamSchema });

/** `GET /authoring/items`: a course's active items whose key contains `q`. */
export const authoringItemQuerySchema = z.object({
  course: idParamSchema,
  type: typeIdSchema.optional(),
  q: z.string().max(200).optional(),
});

export const authoringItemSummarySchema = z.object({
  id: idSchema,
  key: stableKeySchema,
  type: typeIdSchema,
  levelCode: levelCodeSchema.nullable(),
  source: nonEmptyTextSchema.nullable(),
  overridden: z.boolean(),
});
export type AuthoringItemSummary = z.infer<typeof authoringItemSummarySchema>;

export const authoringItemListSchema = z.object({ items: z.array(authoringItemSummarySchema) });

/** One item as the editor sees it: imported `data`, author `overrides` and the two merged. */
export const authoringItemSchema = z.object({
  id: idSchema,
  key: stableKeySchema,
  type: typeIdSchema,
  levelCode: levelCodeSchema.nullable(),
  source: nonEmptyTextSchema.nullable(),
  datasetVersion: nonEmptyTextSchema.nullable(),
  data: jsonObjectSchema,
  overrides: jsonObjectSchema,
  /** `data` with `overrides` applied: what learners see. */
  effective: jsonObjectSchema,
  fields: z.array(itemFieldSchema),
});
export type AuthoringItem = z.infer<typeof authoringItemSchema>;

/**
 * `PATCH /authoring/items/:id`: replaces the item's overrides. A field left out has no override
 * (the clear action). The merged data must pass the plugin's item schema (DR-06).
 */
export const updateItemOverridesRequestSchema = z.object({ overrides: jsonObjectSchema });
export type UpdateItemOverridesRequest = z.infer<typeof updateItemOverridesRequestSchema>;

import { z } from 'zod';
import type { LanguagePlugin } from './languagePlugin';
import {
  idSchema,
  jsonObjectSchema,
  langCodeSchema,
  levelCodeSchema,
  nonEmptyTextSchema,
  pluginIdSchema,
  publishStatusSchema,
  stableKeySchema,
  timestampSchema,
  typeIdSchema,
} from './primitives';

/**
 * Course content (SDD section 5, migration 0001). Field names are the camelCase API form of the
 * table columns; the audit columns created_at and updated_at are left out.
 */

const positionSchema = z.number().int().min(0);

export const courseSchema = z.object({
  id: idSchema,
  key: stableKeySchema,
  targetLang: langCodeSchema,
  baseLang: langCodeSchema,
  plugin: pluginIdSchema,
  title: nonEmptyTextSchema,
  status: publishStatusSchema,
});
export type Course = z.infer<typeof courseSchema>;

export const sectionSchema = z.object({
  id: idSchema,
  courseId: idSchema,
  key: stableKeySchema,
  position: positionSchema,
  title: nonEmptyTextSchema,
  levelCode: levelCodeSchema,
  archivedAt: timestampSchema.nullable(),
});
export type Section = z.infer<typeof sectionSchema>;

export const unitSchema = z.object({
  id: idSchema,
  sectionId: idSchema,
  key: stableKeySchema,
  position: positionSchema,
  title: nonEmptyTextSchema,
  status: publishStatusSchema,
  archivedAt: timestampSchema.nullable(),
});
export type Unit = z.infer<typeof unitSchema>;

/** FR-040: the six lesson types. The Product Spec's "Unit review" is stored as `unit_review`. */
export const lessonTypeSchema = z.enum([
  'kana',
  'vocabulary',
  'kanji',
  'grammar',
  'listening',
  'unit_review',
]);
export type LessonType = z.infer<typeof lessonTypeSchema>;

export const lessonSchema = z.object({
  id: idSchema,
  unitId: idSchema,
  key: stableKeySchema,
  position: positionSchema,
  type: lessonTypeSchema,
  title: nonEmptyTextSchema,
  status: publishStatusSchema,
  archivedAt: timestampSchema.nullable(),
});
export type Lesson = z.infer<typeof lessonSchema>;

/**
 * The language-neutral item envelope. `type` names one of the course plugin's `itemSchemas`
 * (for Japanese: kana, kanji, word, grammar), and `data` holds the language-specific fields that
 * schema validates (DR-06). `overrides` are author edits kept apart from imported values (DR-09).
 */
export const itemSchema = z
  .object({
    id: idSchema,
    courseId: idSchema,
    key: stableKeySchema,
    type: typeIdSchema,
    levelCode: levelCodeSchema.nullable(),
    data: jsonObjectSchema,
    overrides: jsonObjectSchema,
    source: nonEmptyTextSchema.nullable(),
    datasetVersion: nonEmptyTextSchema.nullable(),
    archivedAt: timestampSchema.nullable(),
  })
  .refine((item) => item.datasetVersion === null || item.source !== null, {
    message: 'A dataset version needs a source',
    path: ['datasetVersion'],
  });
export type Item = z.infer<typeof itemSchema>;

/** contains: word contains kanji; related: grammar related to grammar; component: kanji part. */
export const itemLinkKindSchema = z.enum(['contains', 'related', 'component']);
export type ItemLinkKind = z.infer<typeof itemLinkKindSchema>;

export const itemLinkSchema = z
  .object({ fromItemId: idSchema, toItemId: idSchema, kind: itemLinkKindSchema })
  .refine((link) => link.fromItemId !== link.toItemId, {
    message: 'An item cannot link to itself',
    path: ['toItemId'],
  });
export type ItemLink = z.infer<typeof itemLinkSchema>;

/** Thrown when an item names a type the course's language plugin does not define. */
export class UnknownItemTypeError extends Error {
  constructor(
    readonly language: string,
    readonly itemType: string,
  ) {
    super(`Language plugin "${language}" has no item type "${itemType}"`);
    this.name = 'UnknownItemTypeError';
  }
}

/**
 * DR-06: validates an item's language-specific `data` against the plugin's schema for its type.
 * Throws UnknownItemTypeError for a type the plugin does not define, and a ZodError for bad data.
 */
export function parseItemData(plugin: LanguagePlugin, itemType: string, data: unknown): unknown {
  const schema = Object.hasOwn(plugin.itemSchemas, itemType)
    ? plugin.itemSchemas[itemType]
    : undefined;
  if (!schema) throw new UnknownItemTypeError(plugin.code, itemType);
  return schema.parse(data);
}

/** Where a stored exercise came from (`exercises.origin`). */
export const exerciseOriginSchema = z.enum(['authored', 'generated', 'pinned']);
export type ExerciseOrigin = z.infer<typeof exerciseOriginSchema>;

/**
 * A stored exercise row. `payload` is validated by the payload schema of the exercise type
 * registered under `type` (see exerciseRegistry.ts). It belongs to a lesson, an item, or both.
 */
export const storedExerciseSchema = z
  .object({
    id: idSchema,
    lessonId: idSchema.nullable(),
    itemId: idSchema.nullable(),
    type: typeIdSchema,
    payload: jsonObjectSchema,
    origin: exerciseOriginSchema,
  })
  .refine((exercise) => exercise.lessonId !== null || exercise.itemId !== null, {
    message: 'An exercise belongs to a lesson or an item',
    path: ['lessonId'],
  });
export type StoredExercise = z.infer<typeof storedExerciseSchema>;

/**
 * FR-077: a character's stroke data in Hanzi Writer's format, as `stroke_data.strokes` stores it
 * and `GET /media/strokes/:itemKey` serves it: an outline path and a median per stroke, in its
 * 1024-unit y-up space.
 */
export const strokeDataSchema = z.object({
  strokes: z.array(z.string()).min(1),
  medians: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});
export type StrokeData = z.infer<typeof strokeDataSchema>;

export const strokeItemKeyParamsSchema = z.object({ itemKey: stableKeySchema });

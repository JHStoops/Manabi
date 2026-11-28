import { z } from 'zod';
import { exerciseOriginSchema, itemSchema, lessonSchema } from './content';
import { lessonSessionSchema, sessionExerciseSchema } from './lessonSession';
import {
  idParamSchema,
  idSchema,
  jsonObjectSchema,
  nonEmptyTextSchema,
  typeIdSchema,
} from './primitives';

/**
 * The lesson editor (`/authoring/lessons/:id/...`, `/authoring/exercises`; FR-223, FR-224,
 * FR-237, FR-238, Product Spec section 11). Admin only.
 */

/** A lesson's stored exercise (authored or pinned) as the editor lists it, in lesson order. */
export const editorExerciseSchema = z.object({
  id: idSchema,
  type: typeIdSchema,
  payload: jsonObjectSchema,
  origin: exerciseOriginSchema.exclude(['generated']),
  /** The key a content pack export names it by (DR-02). */
  key: z.string().nullable(),
  /**
   * #259, SDD section 6: a pin whose recorded original the generators no longer make (new prompt
   * wording, an item data override), so lessons and reviews serve it next to the changed
   * exercise. Re-tie it (`POST /authoring/exercises/:id/retie`) or remove it. False otherwise.
   */
  detached: z.boolean(),
});
export type EditorExercise = z.infer<typeof editorExerciseSchema>;

/** `GET /authoring/lessons/:id/editor`: the lesson, its new items and its stored exercises. */
export const lessonEditorSchema = z.object({
  lesson: lessonSchema.omit({ archivedAt: true }).extend({
    courseId: idSchema,
    /** The course's language plugin, to show items and run renderers. */
    plugin: z.string(),
    /** The section's level, which the plugin's teaching cards depend on (FR-141). */
    sectionLevel: z.string(),
  }),
  items: z.array(itemSchema),
  exercises: z.array(editorExerciseSchema),
});
export type LessonEditor = z.infer<typeof lessonEditorSchema>;

/** `PUT /authoring/lessons/:id/items`: the lesson's new items, in teaching order. */
export const setLessonItemsRequestSchema = z.object({
  itemIds: z
    .array(idSchema)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, 'Each item once'),
});
export type SetLessonItemsRequest = z.infer<typeof setLessonItemsRequestSchema>;

/** `GET /authoring/lessons/:id/generated`: what the generators make from the new items now. */
export const generatedExercisesSchema = z.object({ exercises: z.array(sessionExerciseSchema) });
export type GeneratedExercises = z.infer<typeof generatedExercisesSchema>;

/**
 * FR-238: answer text sent without tiles, or with an empty list, is segmented on save; tiles sent are kept, since the
 * author may have edited them. `resegment` re-segments every answer text, replacing its tiles.
 */
const resegmentSchema = z.boolean().default(false);

/**
 * `POST /authoring/exercises`: a hand-written exercise (`authored`) or a generated one kept as is
 * (`pinned`). The payload is validated by its type's schema once tiles are filled in (FR-223).
 */
export const createExerciseRequestSchema = z.object({
  lessonId: idSchema,
  type: typeIdSchema,
  origin: z.enum(['authored', 'pinned']),
  payload: jsonObjectSchema,
  /**
   * #254: for a pin, the generated payload it was made from, before the author edited it; lesson
   * and review building match the pin to that original. Defaults to `payload`.
   */
  original: jsonObjectSchema.optional(),
  resegment: resegmentSchema,
});
export type CreateExerciseRequest = z.input<typeof createExerciseRequestSchema>;

/** `PATCH /authoring/exercises/:id`: a new payload for the same type. */
export const updateExerciseRequestSchema = z.object({
  payload: jsonObjectSchema,
  resegment: resegmentSchema,
});
export type UpdateExerciseRequest = z.input<typeof updateExerciseRequestSchema>;

/** An exercise write's result. FR-237: blocklist words found in its text, as a warning. */
export const exerciseWriteSchema = z.object({
  exercise: editorExerciseSchema,
  blockedWords: z.array(nonEmptyTextSchema),
});
export type ExerciseWrite = z.infer<typeof exerciseWriteSchema>;

/**
 * #259: `POST /authoring/exercises/:id/retie`: the pin, tied to an exercise the generators make
 * now, the one closest to its payload. The pin's payload and accept list stay as they are.
 */
export const retieExerciseSchema = z.object({ exercise: editorExerciseSchema });
export type RetieExercise = z.infer<typeof retieExerciseSchema>;

/**
 * FR-224: `POST /authoring/lessons/:id/preview`: the lesson as a session would start it, built the
 * same way, but nothing is saved: no session row, and the player records no completion.
 */
export const lessonPreviewSchema = lessonSessionSchema.omit({ id: true, expiresAt: true });
export type LessonPreview = z.infer<typeof lessonPreviewSchema>;

/**
 * `GET /authoring/items/:id/exercises`: an item's item-level exercises, such as generated review
 * exercises pinned by accepting an answer report (FR-229, Product Spec section 11), oldest first.
 * They are edited with `PATCH /authoring/exercises/:id`.
 */
export const itemExercisesSchema = z.object({ exercises: z.array(editorExerciseSchema) });
export type ItemExercises = z.infer<typeof itemExercisesSchema>;

/** `DELETE /authoring/items/:id/exercises/:exerciseId`. */
export const itemExerciseParamsSchema = z.object({ id: idParamSchema, exerciseId: idParamSchema });

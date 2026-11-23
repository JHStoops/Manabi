import { z } from 'zod';
import type { LessonType } from './content';
import { itemSchema } from './content';
import {
  idParamSchema,
  idSchema,
  jsonObjectSchema,
  timestampSchema,
  typeIdSchema,
} from './primitives';

/** Lesson sessions (`POST /lessons/:id/sessions`; FR-041, FR-050, SDD section 6). */

/** FR-041: a lesson session holds 10 to 15 exercises. */
export const LESSON_MIN_EXERCISES = 10;
export const LESSON_MAX_EXERCISES = 15;

/**
 * SDD section 6: the exercise types generators fill a lesson with, in turn, per lesson type.
 * FR-049: only kana, vocabulary, kanji and listening lessons are generated; grammar and unit
 * review lessons use their stored exercises. Types the course's plugin has no generator for are
 * skipped. The ids are the exercise registry's type ids (EX-01 to EX-04, issues #32 to #34).
 */
export const lessonRecipes: Readonly<Record<LessonType, readonly string[]>> = {
  kana: ['choice', 'typed_answer', 'match_pairs'],
  vocabulary: ['choice', 'word_bank', 'typed_answer', 'match_pairs'],
  kanji: ['choice', 'typed_answer'],
  listening: ['choice', 'typed_answer'],
  grammar: [],
  unit_review: [],
};

/** `/lessons/:id/...`. */
export const lessonIdParamsSchema = z.object({ id: idParamSchema });

/** FR-041: one teaching card per new item of the lesson, in lesson order. */
export const teachingCardSchema = z.object({ item: itemSchema });
export type TeachingCard = z.infer<typeof teachingCardSchema>;

/**
 * One exercise of a session: its registry type id and payload (prompt, options, accept list with
 * tiles). Items it uses are named by `itemId` fields inside the payload (tiles, refs).
 */
export const sessionExerciseSchema = z.object({ type: typeIdSchema, payload: jsonObjectSchema });
export type SessionExercise = z.infer<typeof sessionExerciseSchema>;

/** What `lesson_sessions.state` holds (FR-050). */
export const lessonSessionStateSchema = z.object({
  teachingCards: z.array(teachingCardSchema),
  exercises: z.array(sessionExerciseSchema).min(LESSON_MIN_EXERCISES).max(LESSON_MAX_EXERCISES),
});
export type LessonSessionState = z.infer<typeof lessonSessionStateSchema>;

/** FR-041, FR-050: a started or resumed lesson session. */
export const lessonSessionSchema = lessonSessionStateSchema.extend({
  id: idSchema,
  lessonId: idSchema,
  expiresAt: timestampSchema,
});
export type LessonSession = z.infer<typeof lessonSessionSchema>;

/** FR-048: every `itemId` named anywhere in an exercise payload (tiles, option refs). */
export function payloadItemIds(payload: unknown): number[] {
  if (Array.isArray(payload)) return payload.flatMap(payloadItemIds);
  if (typeof payload !== 'object' || payload === null) return [];
  return Object.entries(payload).flatMap(([key, value]) =>
    key === 'itemId' && typeof value === 'number' ? [value] : payloadItemIds(value),
  );
}

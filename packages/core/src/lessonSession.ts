import { z } from 'zod';
import type { LessonType } from './content';
import { itemSchema, lessonTypeSchema } from './content';
import { coursePathSchema } from './coursePath';
import { exerciseResponseSchema } from './exerciseRegistry';
import { tileSchema } from './sentence';
import {
  idParamSchema,
  idSchema,
  jsonObjectSchema,
  nonEmptyTextSchema,
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

/**
 * FR-041, Product Spec section 4: one teaching card per new item of the lesson, in lesson order,
 * with one example sentence (its tiles for audio) and translation when one fits.
 */
export const teachingCardSchema = z.object({
  item: itemSchema,
  example: z
    .object({
      text: nonEmptyTextSchema,
      translation: nonEmptyTextSchema,
      tiles: z.array(tileSchema),
    })
    .optional(),
});
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
  /** Product Spec section 4: the intro names the lesson's title and type. */
  lessonTitle: z.string(),
  lessonType: lessonTypeSchema,
  /** The lesson's section level: the plugin's teaching cards depend on it (FR-141). */
  sectionLevel: z.string(),
  /** The course's language plugin code, so the player grades and shows items with it. */
  plugin: z.string(),
});
export type LessonSession = z.infer<typeof lessonSessionSchema>;

/** `/lesson-sessions/:id/...`. */
export const lessonSessionIdParamsSchema = z.object({ id: idParamSchema });

/**
 * FR-053: body of `POST /lesson-sessions/:id/complete`: the learner's response to each session
 * exercise, in session order, as answered before the retry round. Any correctness the client
 * adds is dropped; the server re-grades.
 */
export const lessonCompletionRequestSchema = z.object({
  responses: z.array(exerciseResponseSchema).min(LESSON_MIN_EXERCISES).max(LESSON_MAX_EXERCISES),
});
export type LessonCompletionRequest = z.infer<typeof lessonCompletionRequestSchema>;

/** FR-051: the result of completing a lesson, with the updated path for the path provider. */
export const lessonCompletionSchema = z.object({
  lessonId: idSchema,
  /** Whole percentage of exercises right before the retry round, as the server graded them. */
  accuracy: z.number().int().min(0).max(100),
  xpEarned: z.number().int().min(0),
  /** The course's XP total and level after the award (FR-162). */
  totalXp: z.number().int().min(0),
  level: z.number().int().min(1),
  path: coursePathSchema,
});
export type LessonCompletion = z.infer<typeof lessonCompletionSchema>;

/** FR-048: every `itemId` named anywhere in an exercise payload (tiles, option refs). */
export function payloadItemIds(payload: unknown): number[] {
  if (Array.isArray(payload)) return payload.flatMap(payloadItemIds);
  if (typeof payload !== 'object' || payload === null) return [];
  return Object.entries(payload).flatMap(([key, value]) =>
    key === 'itemId' && typeof value === 'number' ? [value] : payloadItemIds(value),
  );
}

/** FR-024, Product Spec section 3: a unit test-out has 20 exercises and passes at 85%. */
export const TEST_OUT_EXERCISES = 20;
export const TEST_OUT_PASS_ACCURACY = 85;

/** `/units/:id/...`. */
export const unitIdParamsSchema = z.object({ id: idParamSchema });

/** What `lesson_sessions.state` holds for a test-out: exercises only, no teaching cards. */
export const testOutStateSchema = z.object({
  exercises: z.array(sessionExerciseSchema).length(TEST_OUT_EXERCISES),
});
export type TestOutState = z.infer<typeof testOutStateSchema>;

/** FR-024, FR-050: `POST /units/:id/test-out`, a started or resumed test-out session. */
export const testOutSessionSchema = testOutStateSchema.extend({
  id: idSchema,
  unitId: idSchema,
  unitTitle: z.string(),
  expiresAt: timestampSchema,
  sectionLevel: z.string(),
  plugin: z.string(),
});
export type TestOutSession = z.infer<typeof testOutSessionSchema>;

/** FR-053: body of `POST /test-out-sessions/:id/complete`, one response per exercise. */
export const testOutCompletionRequestSchema = z.object({
  responses: z.array(exerciseResponseSchema).length(TEST_OUT_EXERCISES),
});
export type TestOutCompletionRequest = z.infer<typeof testOutCompletionRequestSchema>;

/** FR-024: the result of a test-out; a pass completes the unit and earns test-out XP. */
export const testOutCompletionSchema = lessonCompletionSchema.omit({ lessonId: true }).extend({
  unitId: idSchema,
  passed: z.boolean(),
});
export type TestOutCompletion = z.infer<typeof testOutCompletionSchema>;

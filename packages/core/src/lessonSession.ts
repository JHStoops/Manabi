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
  kanji: [
    'stroke_trace',
    'choice',
    'typed_answer',
    'reading_in_context',
    'match_pairs',
    'draw_memory',
  ],
  listening: ['choice', 'typed_answer'],
  grammar: [],
  unit_review: [],
};

/**
 * One step of a lesson flow: an exercise type, the facet it tests (passed to the generator as
 * `GeneratorContext.facet`) and what it is made for: the lesson's new items, or the taught items
 * that contain them (item links of kind `contains`, such as words that use a kanji). `everyItem`
 * steps are made for every new item.
 */
export interface LessonFlowStep {
  type: string;
  facet?: string;
  targets?: 'new' | 'containing';
  everyItem?: boolean;
  /** An `everyItem` step that comes after one exercise of each facet when the session is short. */
  optional?: boolean;
}

/**
 * Product Spec section 5 (Kanji lesson flow), FR-040, FR-049: a kanji lesson's exercises in this
 * order: stroke trace (EX-11); meaning (EX-01, EX-04); reading (EX-09, EX-04); words that use the
 * kanji (EX-01, EX-02); and draw from memory (EX-12) for every kanji before the lesson ends.
 * A session holds at most 15, so when there are too many kanji the trace and the word exercises
 * give way first: every kanji keeps its draw from memory and one meaning and one reading exercise
 * (owner decision on #53).
 */
export const KANJI_LESSON_FLOW: readonly LessonFlowStep[] = [
  { type: 'stroke_trace', everyItem: true, optional: true },
  { type: 'choice', facet: 'meaning' },
  { type: 'typed_answer', facet: 'meaning' },
  { type: 'reading_in_context', facet: 'reading' },
  { type: 'typed_answer', facet: 'reading' },
  { type: 'choice', targets: 'containing' },
  { type: 'match_pairs', targets: 'containing' },
  { type: 'draw_memory', everyItem: true },
];

/** Lesson types whose sessions follow a flow, step by step, instead of the round-robin recipe. */
export const lessonFlows: Readonly<Partial<Record<LessonType, readonly LessonFlowStep[]>>> = {
  kanji: KANJI_LESSON_FLOW,
};

/** Product Spec section 5: a kanji's reading card shows 1 to 3 words that use it. */
export const TEACHING_CARD_MAX_WORDS = 3;

/**
 * FR-091, Product Spec section 6: a grammar lesson's authored exercises in this order:
 * recognition (EX-01), formation (EX-05, EX-10), production (EX-06, EX-03), then one listening
 * exercise (EX-07). Authored exercises of other types are left out.
 */
export const GRAMMAR_EXERCISE_ORDER: readonly string[] = [
  'choice',
  'fill_blank',
  'conjugate',
  'reorder',
  'word_bank',
  'listen_choose',
];

/** `/lessons/:id/...`. */
export const lessonIdParamsSchema = z.object({ id: idParamSchema });

/**
 * FR-041, Product Spec sections 4 and 6: one teaching card per new item of the lesson, in lesson
 * order, with example sentences (their tiles for audio) and translations: one for most items,
 * two for a grammar point, fewer when fewer fit.
 */
export const teachingCardSchema = z.object({
  item: itemSchema,
  examples: z
    .array(
      z.object({
        text: nonEmptyTextSchema,
        translation: nonEmptyTextSchema,
        tiles: z.array(tileSchema),
      }),
    )
    .max(2)
    // Sessions saved before #59 have none; they still resume and complete.
    .default([]),
  /**
   * Product Spec section 5: taught items that contain this one (a kanji's words), shown with its
   * reading. Empty for other items, and in sessions saved before #53.
   */
  words: z.array(itemSchema).max(TEACHING_CARD_MAX_WORDS).default([]),
  /** FR-071: play the item's stroke-order animation (it has stroke data and the course draws). */
  strokeAnimation: z.boolean().default(false),
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

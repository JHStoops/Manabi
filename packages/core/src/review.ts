import { z } from 'zod';
import { unlockedAchievementsSchema } from './achievements';
import { exerciseResponseSchema } from './exerciseRegistry';
import { sessionExerciseSchema } from './lessonSession';
import {
  idParamSchema,
  idSchema,
  localDateSchema,
  pluginIdSchema,
  timestampSchema,
  typeIdSchema,
} from './primitives';
import { stageSchema } from './progress';

/** Reviews: summary, sessions and answers (FR-110 to FR-117; SDD sections 6 to 8). */

/** FR-114: a review session serves up to 20 items. */
export const REVIEW_SESSION_ITEMS = 20;

/** Product Spec section 7: items of a kana lesson skip straight to stage 4 (Familiar). */
export const KANA_LESSON_START_STAGE = 4;

/** FR-113: `GET /reviews/summary`: items due now and items coming due on each of the next 7 days. */
export const reviewSummarySchema = z.object({
  dueNow: z.number().int().min(0),
  /** Today first, in the learner's time zone; an item counts on the day its first facet is due. */
  forecast: z.array(z.object({ date: localDateSchema, count: z.number().int().min(0) })).length(7),
});
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;

/** One exercise of a review session: the item facet it reviews and the learner's answer so far. */
export const reviewExerciseSchema = sessionExerciseSchema.extend({
  itemId: idSchema,
  facet: typeIdSchema,
  /** The item's course plugin, so the player grades it with the right language. */
  plugin: pluginIdSchema,
  /** As the server graded the answer; null until answered. */
  correct: z.boolean().nullable(),
  /**
   * A wrong answer's exercise asked again at the end until it is right. Retries never change
   * progress: only the first answer counts (FR-112).
   */
  retry: z.boolean(),
});
export type ReviewExercise = z.infer<typeof reviewExerciseSchema>;

/** What `review_sessions.state` holds: the exercises, an item's facets next to each other. */
export const reviewSessionStateSchema = z.object({
  exercises: z.array(
    reviewExerciseSchema.extend({
      courseId: idSchema,
      response: exerciseResponseSchema.optional(),
    }),
  ),
});
export type ReviewSessionState = z.infer<typeof reviewSessionStateSchema>;

/** FR-114: a started or resumed review session. */
export const reviewSessionSchema = z.object({
  id: idSchema,
  expiresAt: timestampSchema,
  exercises: z.array(reviewExerciseSchema),
});
export type ReviewSession = z.infer<typeof reviewSessionSchema>;

/** `/review-sessions/:id/...`. */
export const reviewSessionIdParamsSchema = z.object({ id: idParamSchema });

/** FR-114: body of `POST /review-sessions/:id/answers`: one exercise's response, both attempts. */
export const reviewAnswerRequestSchema = z.object({
  index: z.number().int().min(0),
  response: exerciseResponseSchema,
});
export type ReviewAnswerRequest = z.infer<typeof reviewAnswerRequestSchema>;

/** FR-112: the server's grade, and the item's stage once all its facets in the session are answered. */
export const reviewAnswerResultSchema = z.object({
  correct: z.boolean(),
  /** Null until the item's last facet in the session is answered. */
  stage: stageSchema.nullable(),
  /** Review XP earned by this answer: 1 when it settles the item as right (FR-160). */
  xpEarned: z.number().int().min(0),
  /** Where a wrong answer's exercise was queued again at the end; null when right. */
  retryIndex: z.number().int().min(0).nullable(),
  /** FR-165: achievements this answer unlocked, to celebrate once. */
  achievements: unlockedAchievementsSchema,
});
export type ReviewAnswerResult = z.infer<typeof reviewAnswerResultSchema>;

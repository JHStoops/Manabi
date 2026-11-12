import { z } from 'zod';
import { idSchema, timestampSchema, typeIdSchema } from './primitives';

/** Learner progress (SDD section 5, migration 0003). The server is the source of truth. */

/** Review stages 1 to 7 are on the ladder; 8 is Retired and never due (Product Spec section 7). */
export const stageSchema = z.number().int().min(1).max(8);
export type Stage = z.infer<typeof stageSchema>;
export const RETIRED_STAGE = 8;

/** FR-162: XP total and level per course. */
export const enrollmentSchema = z.object({
  courseId: idSchema,
  startedAt: timestampSchema,
  totalXp: z.number().int().min(0),
  level: z.number().int().min(1),
});
export type Enrollment = z.infer<typeof enrollmentSchema>;

/** FR-020, FR-021: present once a lesson has been completed at least once. */
export const lessonProgressSchema = z.object({
  lessonId: idSchema,
  completedAt: timestampSchema,
  /** Best accuracy over all completions, as a whole percentage. */
  bestAccuracy: z.number().int().min(0).max(100),
  timesCompleted: z.number().int().min(1),
});
export type LessonProgress = z.infer<typeof lessonProgressSchema>;

/** FR-110: one row per item and review facet; `dueAt` is null exactly at the retired stage. */
export const itemProgressSchema = z
  .object({
    itemId: idSchema,
    facet: typeIdSchema,
    stage: stageSchema,
    dueAt: timestampSchema.nullable(),
    lastReviewedAt: timestampSchema.nullable(),
    correctCount: z.number().int().min(0),
    wrongCount: z.number().int().min(0),
  })
  .refine((p) => (p.stage === RETIRED_STAGE) === (p.dueAt === null), {
    message: 'dueAt is null exactly when the item is retired',
    path: ['dueAt'],
  });
export type ItemProgress = z.infer<typeof itemProgressSchema>;

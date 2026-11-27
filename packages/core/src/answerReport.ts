import { z } from 'zod';
import type { Exercise } from './exerciseRegistry';
import { sessionExerciseSchema } from './lessonSession';
import { pageSchema, paginationQuerySchema } from './pagination';
import {
  idSchema,
  jsonObjectSchema,
  pluginIdSchema,
  timestampSchema,
  typeIdSchema,
} from './primitives';

/**
 * Answer reports (FR-054, FR-229; Product Spec sections 4 and 11): a learner reports an answer they
 * believe should be accepted, and an author accepts it (adding it to the exercise's accept list)
 * or dismisses it.
 */

/** The longest answer a report keeps. */
export const ANSWER_REPORT_MAX_LENGTH = 200;

export const answerReportStatusSchema = z.enum(['open', 'accepted', 'dismissed']);
export type AnswerReportStatus = z.infer<typeof answerReportStatusSchema>;

/**
 * Whether an exercise's answer is checked against an accept list an author can extend (Product
 * Spec section 4: typed exercises), so a report on it can be accepted.
 */
export function acceptsAnswerReports(exercise: Exercise): boolean {
  const payload = exercise.payload as { accept?: unknown } | null;
  return typeof payload === 'object' && payload !== null && Array.isArray(payload.accept);
}

/**
 * FR-054: body of `POST /answer-reports`. The exercise is named by the session it was played in
 * and its type and payload as served; the server reports its own copy from that session, never
 * the client's. `lesson` covers lesson and unit test-out sessions.
 */
export const createAnswerReportRequestSchema = z
  .object({
    session: z.object({ kind: z.enum(['lesson', 'review']), id: idSchema }).strict(),
    exercise: sessionExerciseSchema,
    answer: z.string().trim().min(1).max(ANSWER_REPORT_MAX_LENGTH),
  })
  .strict();
export type CreateAnswerReportRequest = z.infer<typeof createAnswerReportRequestSchema>;

/** What the learner gets back: their report, open until an author resolves it. */
export const answerReportReceiptSchema = z.object({
  id: idSchema,
  status: answerReportStatusSchema,
  createdAt: timestampSchema,
});
export type AnswerReportReceipt = z.infer<typeof answerReportReceiptSchema>;

/** FR-229: one report in the author inbox. */
export const answerReportSchema = z.object({
  id: idSchema,
  status: answerReportStatusSchema,
  /** The exercise as the learner saw it. */
  exerciseType: typeIdSchema,
  exercisePayload: jsonObjectSchema,
  givenAnswer: z.string(),
  /** The stored exercise; null for a generated one until accepting pins it. */
  exerciseId: idSchema.nullable(),
  /** The current accept list of the stored exercise, when there is one. */
  currentAccept: z.array(z.string()).nullable(),
  itemId: idSchema.nullable(),
  /** The lesson the report was filed from; null for reviews. */
  lessonId: idSchema.nullable(),
  courseId: idSchema,
  courseTitle: z.string(),
  plugin: pluginIdSchema,
  /** Null once the reporter's account is deleted (DR-07). */
  reporter: z.string().nullable(),
  createdAt: timestampSchema,
  resolvedAt: timestampSchema.nullable(),
});
export type AnswerReport = z.infer<typeof answerReportSchema>;

/** `GET /authoring/reports`: open reports by default, oldest first. */
export const answerReportsQuerySchema = paginationQuerySchema.extend({
  status: answerReportStatusSchema.default('open'),
});
export type AnswerReportsQuery = z.infer<typeof answerReportsQuerySchema>;

export const answerReportPageSchema = pageSchema(answerReportSchema);
export type AnswerReportPage = z.infer<typeof answerReportPageSchema>;

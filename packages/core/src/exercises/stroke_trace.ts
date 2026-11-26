import { z } from 'zod';
import { registerExerciseType } from '../exerciseRegistry';
import { stableKeySchema } from '../primitives';

/**
 * EX-11 stroke trace (FR-044, FR-072, FR-073): trace each stroke of a character over a guide, in
 * order. Hanzi Writer judges each stroke in the browser and discards wrong ones (SDD section 6),
 * so the answer is only reported once every stroke is drawn, with the number of discarded strokes.
 */
export const STROKE_TRACE_TYPE = 'stroke_trace';

/**
 * Hanzi Writer's matcher leniency (FR-072), shared by the stroke canvas and the regression test
 * over recorded attempts (#2). Above 1, misplaced and straightened strokes start to pass.
 */
export const STROKE_LENIENCY = 1;

export const strokeTracePayloadSchema = z
  .object({
    /** The kanji or kana item whose stroke data `GET /media/strokes/:itemKey` serves. */
    itemKey: stableKeySchema,
    /** The character itself, which Hanzi Writer and the accessible name use. */
    character: z.string().min(1).max(2),
  })
  .strict();
export type StrokeTracePayload = z.infer<typeof strokeTracePayloadSchema>;

/** The finished trace: how many drawn strokes were discarded on the way. */
export const strokeTraceAnswerSchema = z.object({ mistakes: z.number().int().min(0) }).strict();
export type StrokeTraceAnswer = z.infer<typeof strokeTraceAnswerSchema>;

registerExerciseType({
  id: STROKE_TRACE_TYPE,
  payloadSchema: strokeTracePayloadSchema,
  answerSchema: strokeTraceAnswerSchema,
  // Trace mode only finishes with every stroke right (wrong ones are discarded and redrawn), so a
  // finished trace is correct; mistakes are recorded with the response, not graded.
  grade: () => ({ result: 'correct' }),
});

import type { z } from 'zod';
import { registerExerciseType } from '../exerciseRegistry';
import { nonEmptyTextSchema } from '../primitives';
import {
  STROKE_TRACE_TYPE,
  strokeTraceAnswerSchema,
  strokeTracePayloadSchema,
} from './stroke_trace';

/**
 * EX-12 draw from memory (FR-044, FR-073): draw the character with no guide, given its meaning or
 * reading. Hanzi Writer judges stroke count, order and rough shape in the browser, like EX-11, and
 * flashes the stroke once after 2 misses; the answer is reported once every stroke is drawn.
 */
export const DRAW_MEMORY_TYPE = 'draw_memory';

/** FR-074: the drawing exercise types, left out of sessions when a learner turns drawing off. */
export const DRAWING_EXERCISE_TYPES: readonly string[] = [STROKE_TRACE_TYPE, DRAW_MEMORY_TYPE];

export const drawMemoryPayloadSchema = strokeTracePayloadSchema
  .extend({
    /** What to draw, by meaning or reading, without the character itself. */
    prompt: nonEmptyTextSchema,
  })
  .strict();
export type DrawMemoryPayload = z.infer<typeof drawMemoryPayloadSchema>;

export const drawMemoryAnswerSchema = strokeTraceAnswerSchema;
export type DrawMemoryAnswer = z.infer<typeof drawMemoryAnswerSchema>;

registerExerciseType({
  id: DRAW_MEMORY_TYPE,
  payloadSchema: drawMemoryPayloadSchema,
  answerSchema: drawMemoryAnswerSchema,
  // As EX-11: the quiz only finishes with every stroke right, so a finished drawing is correct.
  grade: () => ({ result: 'correct' }),
});

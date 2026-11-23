import { z } from 'zod';
import type { CheckResult, LanguagePlugin } from './languagePlugin';
import { typeIdSchema } from './primitives';

/**
 * The exercise type registry (SDD section 6, NFR-53). Adding an exercise type means one
 * registerExerciseType call here in core (id, payload schema, answer schema, grader), one renderer
 * in apps/web and, optionally, a generator in the language plugin. See README.md.
 */

/** An exercise as a session holds it: its type id and payload (stored or generated). */
export interface Exercise {
  type: string;
  payload: unknown;
}

/**
 * What the learner submitted for one exercise: the first answer and, after a wrong first answer
 * in a lesson or review, the immediate second one (FR-046). Each answer is validated by the
 * type's answer schema when graded.
 */
export const exerciseResponseSchema = z.object({ attempts: z.array(z.unknown()).min(1).max(2) });
export type ExerciseResponse = z.infer<typeof exerciseResponseSchema>;

/** A grade: correct, near-miss with a hint, or wrong, plus optional feedback text to show. */
export type GradeResult = CheckResult & { feedback?: string };

/**
 * One exercise type. The same grader runs in the browser for instant feedback and on the server
 * for the authoritative re-grade (FR-053), so it must be pure: no Node or browser APIs.
 */
export interface ExerciseTypeDefinition<Payload = unknown, Answer = unknown> {
  /** Type id stored in `exercises.type`, `review_log.exercise_type` and reports. */
  id: string;
  /** Validates the stored JSONB payload (prompt, options, accept list with tiles, refs). */
  payloadSchema: z.ZodType<Payload, unknown>;
  /** Validates one answer as the renderer reports it through onAnswer (NFR-13). */
  answerSchema: z.ZodType<Answer, unknown>;
  /** Grades one answer. Language-specific checking goes through the plugin (FR-240). */
  grade(payload: Payload, answer: Answer, plugin: LanguagePlugin): GradeResult;
}

/** Thrown when an exercise type id is not registered. */
export class UnknownExerciseTypeError extends Error {
  constructor(readonly exerciseType: string) {
    super(`Unknown exercise type "${exerciseType}"`);
    this.name = 'UnknownExerciseTypeError';
  }
}

/** Thrown when a response has a second attempt after a first answer that was not wrong. */
export class SecondAttemptError extends Error {
  constructor() {
    super('A second attempt is only allowed after a wrong first answer');
    this.name = 'SecondAttemptError';
  }
}

const exerciseTypes = new Map<string, ExerciseTypeDefinition>();

/** Registers an exercise type. Throws on a malformed or duplicate type id. */
export function registerExerciseType<Payload, Answer>(
  definition: ExerciseTypeDefinition<Payload, Answer>,
): void {
  if (!typeIdSchema.safeParse(definition.id).success) {
    throw new Error(`Invalid exercise type id "${definition.id}"`);
  }
  if (exerciseTypes.has(definition.id)) {
    throw new Error(`Exercise type "${definition.id}" is registered twice`);
  }
  exerciseTypes.set(definition.id, definition as ExerciseTypeDefinition);
}

/** The definition for a type id; throws UnknownExerciseTypeError when it is not registered. */
export function getExerciseType(id: string): ExerciseTypeDefinition {
  const definition = exerciseTypes.get(id);
  if (!definition) throw new UnknownExerciseTypeError(id);
  return definition;
}

/**
 * Grades a response, on the client after each attempt and on the server when re-grading
 * (FR-053). Validates the payload and every attempt first (throws a ZodError), then returns the
 * deciding grade: the first attempt's unless it was wrong, else the second's. A second attempt
 * after a first that was not wrong is rejected (SecondAttemptError). Throws UnknownExerciseTypeError for an
 * unregistered type.
 */
export function gradeResponse(
  exercise: Exercise,
  response: ExerciseResponse,
  plugin: LanguagePlugin,
): GradeResult {
  const definition = getExerciseType(exercise.type);
  const payload = definition.payloadSchema.parse(exercise.payload);
  const [first, second] = exerciseResponseSchema
    .parse(response)
    .attempts.map((attempt) =>
      definition.grade(payload, definition.answerSchema.parse(attempt), plugin),
    ) as [GradeResult, GradeResult?];
  if (!second) return first;
  if (first.result !== 'wrong') {
    throw new SecondAttemptError();
  }
  return second;
}

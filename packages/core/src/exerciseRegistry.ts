import type { z } from 'zod';
import type { CheckResult, LanguagePlugin } from './languagePlugin';
import { typeIdSchema } from './primitives';

/**
 * The exercise type registry (SDD section 6, NFR-53). Adding an exercise type means one
 * definition here (id, payload schema, response schema, grader), one renderer in apps/web and,
 * optionally, a generator in the language plugin. Exercise types are registered by later issues.
 */

/** What a grader can use besides the payload and the response. */
export interface GraderContext {
  /** The course's language plugin, for answer normalization and checking. */
  plugin: LanguagePlugin;
}

/** A grade: correct, near-miss with a hint, or wrong, plus optional feedback text to show. */
export type GradeResult = CheckResult & { feedback?: string };

/**
 * One exercise type. The same grader runs in the browser for instant feedback and on the server
 * for the authoritative re-grade (SDD section 6), so it must be a pure function.
 */
export interface ExerciseTypeDefinition<Payload = unknown, Response = unknown> {
  /** Type id stored in `exercises.type`, `review_log.exercise_type` and reports. */
  id: string;
  /** Validates the stored JSONB payload (prompt, options, accept list with tiles, refs). */
  payloadSchema: z.ZodType<Payload, unknown>;
  /** Validates the learner's response as the client reports it (NFR-13). */
  responseSchema: z.ZodType<Response, unknown>;
  /** Grades a response against a payload. Declared as a method so definitions can be stored together. */
  grade(payload: Payload, response: Response, context: GraderContext): GradeResult;
}

/** Thrown when an exercise type id is not registered. */
export class UnknownExerciseTypeError extends Error {
  constructor(readonly exerciseType: string) {
    super(`Unknown exercise type "${exerciseType}"`);
    this.name = 'UnknownExerciseTypeError';
  }
}

/** Exercise type definitions keyed by type id. */
export interface ExerciseRegistry {
  /** Registered type ids, in registration order. */
  readonly ids: readonly string[];
  has(id: string): boolean;
  /** The definition for a type id; throws UnknownExerciseTypeError when it is not registered. */
  get(id: string): ExerciseTypeDefinition;
}

/** Builds a registry. Throws on a malformed or duplicate type id. */
export function createExerciseRegistry(
  definitions: readonly ExerciseTypeDefinition[],
): ExerciseRegistry {
  const byId = new Map<string, ExerciseTypeDefinition>();
  for (const definition of definitions) {
    if (!typeIdSchema.safeParse(definition.id).success) {
      throw new Error(`Invalid exercise type id "${definition.id}"`);
    }
    if (byId.has(definition.id)) {
      throw new Error(`Exercise type "${definition.id}" is registered twice`);
    }
    byId.set(definition.id, definition);
  }
  return {
    ids: [...byId.keys()],
    has: (id) => byId.has(id),
    get: (id) => {
      const definition = byId.get(id);
      if (!definition) throw new UnknownExerciseTypeError(id);
      return definition;
    },
  };
}

/**
 * Validates a payload and a response with the type's schemas, then grades. Throws
 * UnknownExerciseTypeError for an unregistered type and a ZodError for invalid input.
 */
export function gradeExercise(
  registry: ExerciseRegistry,
  type: string,
  payload: unknown,
  response: unknown,
  context: GraderContext,
): GradeResult {
  const definition = registry.get(type);
  return definition.grade(
    definition.payloadSchema.parse(payload),
    definition.responseSchema.parse(response),
    context,
  );
}

/** The application's exercise types. Empty until the exercise issues register EX-01 to EX-12. */
export const exerciseRegistry: ExerciseRegistry = createExerciseRegistry([]);

import type { ComponentType, LazyExoticComponent } from 'react';
import { lazy } from 'react';

/**
 * The one renderer contract (SDD section 9, NFR-53): the exercise payload in, the learner's
 * answer out. A renderer calls onAnswer with its current answer whenever it changes (the player
 * owns the Check button and grades the last answer reported with gradeResponse from
 * @manabi/core). The answer must satisfy the type's answerSchema in core.
 */
export interface ExerciseRendererProps<Payload = unknown, Answer = unknown> {
  payload: Payload;
  onAnswer(answer: Answer): void;
}

type Renderer = LazyExoticComponent<ComponentType<ExerciseRendererProps>>;

const renderers = new Map<string, Renderer>();

/**
 * Registers the renderer for an exercise type id, loaded lazily on first render so each type is
 * its own chunk. Throws on a duplicate id.
 */
export function registerExerciseRenderer<Payload, Answer>(
  type: string,
  load: () => Promise<{ default: ComponentType<ExerciseRendererProps<Payload, Answer>> }>,
): void {
  if (renderers.has(type)) throw new Error(`Exercise renderer "${type}" is registered twice`);
  renderers.set(type, lazy(load) as unknown as Renderer);
}

/** The lazy renderer for a type id; render it inside Suspense. Throws when none is registered. */
export function getExerciseRenderer(type: string): Renderer {
  const renderer = renderers.get(type);
  if (!renderer) throw new Error(`No renderer is registered for exercise type "${type}"`);
  return renderer;
}

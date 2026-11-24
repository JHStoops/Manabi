import type { ExerciseResponse, GradeResult, LessonCompletion, LessonSession } from '@manabi/core';

/**
 * The lesson player state machine (SDD section 9, Product Spec section 4): intro, teaching
 * cards, answering (with one second try), feedback, the retry round, completing and results.
 * Grades come from the shared grader in the browser (NFR-03); the server re-grades on completion.
 */
export type PlayerPhase =
  'loading' | 'intro' | 'teaching' | 'answering' | 'feedback' | 'completing' | 'results';

export interface PlayerState {
  phase: PlayerPhase;
  session: LessonSession | null;
  /** The teaching card shown. */
  card: number;
  /** Exercise indexes still to play; the head is the current one. FR-047: misses go to the end. */
  queue: number[];
  /** Exercises presented so far; keys the renderer so a re-presented exercise starts fresh. */
  step: number;
  /** The latest answer the renderer reported; undefined until it reports one. */
  answer: unknown;
  /** Checked answers of the current presentation: one, or two after a wrong first (FR-046). */
  attempts: unknown[];
  /** The grade of the last checked answer. */
  grade: GradeResult | null;
  /** FR-053: each exercise's first-pass response in session order; the retry round adds none. */
  responses: (ExerciseResponse | undefined)[];
  completion: LessonCompletion | null;
  error: unknown;
}

export type PlayerAction =
  | { type: 'loaded'; session: LessonSession }
  /** The primary action: start, next card, continue after feedback, retry a failed completion. */
  | { type: 'next' }
  | { type: 'answered'; answer: unknown }
  /** The grade of the current answer on its own, from gradeResponse. */
  | { type: 'checked'; grade: GradeResult }
  | { type: 'completed'; completion: LessonCompletion }
  | { type: 'failed'; error: unknown };

export const initialPlayerState: PlayerState = {
  phase: 'loading',
  session: null,
  card: 0,
  queue: [],
  step: 0,
  answer: undefined,
  attempts: [],
  grade: null,
  responses: [],
  completion: null,
  error: null,
};

const freshExercise = { answer: undefined, attempts: [], grade: null };

export function lessonPlayerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'loaded':
      return {
        ...initialPlayerState,
        phase: 'intro',
        session: action.session,
        queue: action.session.exercises.map((_, i) => i),
        responses: action.session.exercises.map(() => undefined),
      };

    case 'next':
      switch (state.phase) {
        case 'intro':
          return state.session?.teachingCards.length
            ? { ...state, phase: 'teaching', card: 0 }
            : { ...state, phase: 'answering' };
        case 'teaching':
          return state.card + 1 < (state.session?.teachingCards.length ?? 0)
            ? { ...state, card: state.card + 1 }
            : { ...state, phase: 'answering' };
        case 'feedback': {
          const [current, ...rest] = state.queue;
          // FR-047, FR-168: a miss comes back at the end; nothing ever ends the lesson early.
          const queue = state.grade?.result === 'wrong' ? [...rest, current!] : rest;
          return {
            ...state,
            ...freshExercise,
            phase: queue.length ? 'answering' : 'completing',
            queue,
            step: state.step + 1,
          };
        }
        case 'completing':
          return { ...state, error: null };
        default:
          return state;
      }

    case 'answered':
      return state.phase === 'answering' ? { ...state, answer: action.answer } : state;

    case 'checked': {
      if (state.phase !== 'answering' || state.answer === undefined) return state;
      const attempts = [...state.attempts, state.answer];
      // FR-046: a first wrong answer gets one immediate second try without the answer shown.
      if (action.grade.result === 'wrong' && attempts.length === 1) {
        return { ...state, attempts, grade: action.grade };
      }
      const index = state.queue[0]!;
      const responses = [...state.responses];
      responses[index] ??= { attempts };
      return { ...state, phase: 'feedback', attempts, grade: action.grade, responses };
    }

    case 'completed':
      return { ...state, phase: 'results', completion: action.completion, error: null };

    case 'failed':
      return { ...state, error: action.error };
  }
}

import { playableExercises } from '../audio/speech';
import type {
  ExerciseResponse,
  GradeResult,
  LessonCompletion,
  LessonPreview,
  LessonSession,
  ReviewExercise,
  ReviewSession,
  TestOutCompletion,
  TestOutSession,
} from '@manabi/core';

/**
 * FR-024: the player also plays a unit test-out, which has no teaching cards. FR-224: and an
 * author's preview, which has no session id and whose completion is only its accuracy.
 */
export type PlayerSession = LessonSession | TestOutSession | LessonPreview | ReviewSession;
export type PlayerCompletion =
  LessonCompletion | TestOutCompletion | Pick<LessonCompletion, 'accuracy'>;

const teachingCards = (session: PlayerSession | null) =>
  session && 'teachingCards' in session ? session.teachingCards : [];

/**
 * Whether the card at `card` is due: it comes before the exercise up next (Product Spec section
 * 5, #237: a kanji's reading card shows after its meaning exercises). The first pass plays the
 * exercises in session order, one presentation each, so a card is due once `before` exercises
 * have been presented: a card after the last exercise shows before the retry round. Sessions
 * saved before #237 have every card at 0, so they all show before the first exercise.
 */
const cardDue = (session: PlayerSession | null, card: number, step: number) => {
  const next = teachingCards(session)[card];
  return next !== undefined && next.before <= step;
};

/** After a card, or after the intro or feedback: the next due card, else the next exercise. */
function advance(state: PlayerState, card: number, queue: number[]): PlayerState {
  if (cardDue(state.session, card, state.step)) return { ...state, phase: 'teaching', card, queue };
  return { ...state, phase: queue.length ? 'answering' : 'completing', card, queue };
}

/**
 * The lesson player state machine (SDD section 9, Product Spec section 4): intro, teaching
 * cards, answering (with one second try), feedback, the retry round, completing and results.
 * Grades come from the shared grader in the browser (NFR-03); the server re-grades on completion.
 */
export type PlayerPhase =
  'loading' | 'intro' | 'teaching' | 'answering' | 'feedback' | 'completing' | 'results';

export interface PlayerState {
  phase: PlayerPhase;
  session: PlayerSession | null;
  /**
   * The teaching card shown while teaching; otherwise how many cards have been shown, so the
   * next card to show (cards are in the order they show, by `before`).
   */
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
  completion: PlayerCompletion | null;
  error: unknown;
}

export type PlayerAction =
  | { type: 'loaded'; session: PlayerSession }
  /** The primary action: start, next card, continue after feedback, retry a failed completion. */
  | { type: 'next' }
  /** FR-135: whether the device can speak; without a voice, listening exercises are dropped. */
  | { type: 'canSpeak'; canSpeak: boolean }
  | { type: 'answered'; answer: unknown }
  /** The grade of the current answer on its own, from gradeResponse. */
  | { type: 'checked'; grade: GradeResult }
  /** FR-046: the server queued a missed review exercise again at the end; it plays as a new one. */
  | { type: 'retryQueued'; exercise: ReviewExercise }
  | { type: 'completed'; completion: PlayerCompletion }
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
    case 'loaded': {
      // The server sends cards in showing order; a stable sort by position makes sure of it.
      const session =
        'teachingCards' in action.session
          ? {
              ...action.session,
              teachingCards: [...action.session.teachingCards].sort((a, b) => a.before - b.before),
            }
          : action.session;
      return {
        ...initialPlayerState,
        phase: 'intro',
        session,
        // FR-114: a resumed review skips exercises already answered (the server rejects a second answer).
        queue: action.session.exercises.flatMap((e, i) =>
          'correct' in e && e.correct !== null ? [] : [i],
        ),
        responses: action.session.exercises.map(() => undefined),
      };
    }

    case 'canSpeak': {
      // shortcut: decided once before the first exercise, so a voice that loads later does not
      // bring listening exercises back; upgrade when listening exercises exist (EX-07, EX-08).
      // A mid-lesson card (step > 0) is past the first exercise.
      if (!state.session || !['intro', 'teaching'].includes(state.phase) || state.step > 0)
        return state;
      const all = state.session.exercises;
      const exercises = playableExercises(all, action.canSpeak);
      // A card keeps its place: before the same exercise, or the next one kept.
      const kept = all.map((e) => (exercises as readonly unknown[]).includes(e));
      const position = (before: number) => kept.slice(0, before).filter(Boolean).length;
      const cards =
        'teachingCards' in state.session
          ? {
              teachingCards: state.session.teachingCards.map((c) => ({
                ...c,
                before: position(c.before),
              })),
            }
          : {};
      return {
        ...state,
        session: { ...state.session, exercises, ...cards } as PlayerSession,
        queue: exercises.map((_, i) => i),
        responses: exercises.map(() => undefined),
      };
    }

    case 'next':
      switch (state.phase) {
        case 'intro':
          return cardDue(state.session, 0, state.step)
            ? { ...state, phase: 'teaching', card: 0 }
            : { ...state, phase: 'answering' };
        case 'teaching':
          return advance(state, state.card + 1, state.queue);
        case 'feedback': {
          const [current, ...rest] = state.queue;
          // FR-047, FR-168: a miss comes back at the end; nothing ever ends the lesson early.
          // A review's retry is a new exercise the server appends (retryQueued), not this one again.
          const isReview = 'itemId' in (state.session?.exercises[current!] ?? {});
          const queue = state.grade?.result === 'wrong' && !isReview ? [...rest, current!] : rest;
          return advance({ ...state, ...freshExercise, step: state.step + 1 }, state.card, queue);
        }
        case 'completing':
          return { ...state, error: null };
        default:
          return state;
      }

    case 'answered':
      if (state.phase !== 'answering') return state;
      // An empty answer ('' or []) is no answer, so Check stays unusable. A new answer clears a
      // grading error.
      return {
        ...state,
        answer:
          action.answer === '' || (Array.isArray(action.answer) && !action.answer.length)
            ? undefined
            : action.answer,
        error: null,
      };

    case 'checked': {
      if (state.phase !== 'answering' || state.answer === undefined) return state;
      const attempts = [...state.attempts, state.answer];
      // FR-046: a first wrong answer gets one immediate second try without the answer shown.
      if (action.grade.result === 'wrong' && attempts.length === 1) {
        // The answer is cleared, so the second try needs a new one.
        return { ...state, attempts, answer: undefined, grade: action.grade };
      }
      const index = state.queue[0]!;
      const responses = [...state.responses];
      responses[index] ??= { attempts };
      return { ...state, phase: 'feedback', attempts, grade: action.grade, responses };
    }

    case 'retryQueued': {
      if (!state.session) return state;
      const exercises = [...state.session.exercises, action.exercise];
      return {
        ...state,
        session: { ...state.session, exercises } as PlayerSession,
        queue: [...state.queue, exercises.length - 1],
        responses: [...state.responses, undefined],
      };
    }

    case 'completed':
      return { ...state, phase: 'results', completion: action.completion, error: null };

    case 'failed':
      return { ...state, error: action.error };
  }
}

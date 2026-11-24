import type { Item, LessonSession } from '@manabi/core';
import type { PlayerState } from './lessonPlayer';
import { initialPlayerState, lessonPlayerReducer as reduce } from './lessonPlayer';

// FR-046, FR-047, FR-168: every transition of the lesson player state machine.

const item = { id: 1, data: {} } as unknown as Item;
const session = (cards: number, exercises: number): LessonSession => ({
  id: 7,
  lessonId: 3,
  expiresAt: '2026-11-24T00:00:00.000Z',
  teachingCards: Array.from({ length: cards }, () => ({ item })),
  exercises: Array.from({ length: exercises }, (_, i) => ({ type: 'test_echo', payload: { i } })),
});

const correct = { type: 'checked', grade: { result: 'correct' } } as const;
const wrong = { type: 'checked', grade: { result: 'wrong', feedback: 'Water' } } as const;
const answered = (answer: unknown) => ({ type: 'answered', answer }) as const;
const next = { type: 'next' } as const;

/** Loaded with no teaching cards and started, so exercise 0 is up. */
const playing = (exercises = 2): PlayerState =>
  reduce(reduce(initialPlayerState, { type: 'loaded', session: session(0, exercises) }), next);

describe('lessonPlayerReducer', () => {
  it('loads into the intro with every exercise queued', () => {
    const state = reduce(initialPlayerState, { type: 'loaded', session: session(2, 3) });
    expect(state).toMatchObject({ phase: 'intro', queue: [0, 1, 2], step: 0 });
    expect(state.responses).toEqual([undefined, undefined, undefined]);
  });

  it('walks the intro and each teaching card, then answers', () => {
    let state = reduce(initialPlayerState, { type: 'loaded', session: session(2, 2) });
    state = reduce(state, next);
    expect(state).toMatchObject({ phase: 'teaching', card: 0 });
    state = reduce(state, next);
    expect(state).toMatchObject({ phase: 'teaching', card: 1 });
    expect(reduce(state, next).phase).toBe('answering');
  });

  it('skips teaching when the lesson has no new items', () => {
    expect(playing().phase).toBe('answering');
  });

  it('records the answer only while answering and ignores Check without one', () => {
    const state = playing();
    expect(reduce(state, correct)).toBe(state);
    const withAnswer = reduce(state, answered('Water'));
    expect(withAnswer.answer).toBe('Water');
    const feedback = reduce(withAnswer, correct);
    expect(reduce(feedback, answered('other'))).toBe(feedback);
  });

  it('treats an empty answer as none and clears a grading error on a new answer', () => {
    const state = reduce(playing(), { type: 'failed', error: new Error('bad payload') });
    expect(reduce(state, answered('')).answer).toBeUndefined();
    expect(reduce(state, answered([])).answer).toBeUndefined();
    expect(reduce(state, answered([1])).answer).toEqual([1]);
    expect(reduce(state, answered('a')).error).toBeNull();
  });

  it('shows feedback for a correct first answer and moves on', () => {
    let state = reduce(reduce(playing(), answered('Water')), correct);
    expect(state).toMatchObject({ phase: 'feedback', attempts: ['Water'] });
    expect(state.responses[0]).toEqual({ attempts: ['Water'] });
    state = reduce(state, next);
    expect(state).toMatchObject({ phase: 'answering', queue: [1], step: 1, answer: undefined });
    expect(state.grade).toBeNull();
  });

  it('gives one second try after a wrong first answer, then counts a fix as correct', () => {
    let state = reduce(reduce(playing(), answered('x')), wrong);
    // Amber: still answering, nothing recorded, the exercise stays current.
    expect(state).toMatchObject({ phase: 'answering', attempts: ['x'], queue: [0, 1] });
    expect(state.answer).toBeUndefined(); // the second try needs a new answer
    expect(reduce(state, wrong)).toBe(state);
    expect(state.responses[0]).toBeUndefined();
    state = reduce(reduce(state, answered('Water')), correct);
    expect(state).toMatchObject({ phase: 'feedback', attempts: ['x', 'Water'] });
    expect(state.responses[0]).toEqual({ attempts: ['x', 'Water'] });
    expect(reduce(state, next).queue).toEqual([1]);
  });

  it('re-queues an exercise wrong twice at the end and keeps its first-pass response', () => {
    let state = reduce(reduce(playing(), answered('x')), wrong);
    state = reduce(reduce(state, answered('y')), wrong);
    expect(state).toMatchObject({ phase: 'feedback', grade: { result: 'wrong' } });
    state = reduce(state, next);
    expect(state.queue).toEqual([1, 0]);
    state = reduce(reduce(reduce(state, answered('Water')), correct), next);
    expect(state.queue).toEqual([0]);
    // Retry round: missed again, it comes back again; the recorded response does not change.
    state = reduce(reduce(state, answered('z')), wrong);
    state = reduce(reduce(state, answered('z')), wrong);
    state = reduce(state, next);
    expect(state).toMatchObject({ phase: 'answering', queue: [0], step: 3 });
    state = reduce(reduce(reduce(state, answered('Water')), correct), next);
    expect(state.phase).toBe('completing');
    expect(state.responses).toEqual([{ attempts: ['x', 'y'] }, { attempts: ['Water'] }]);
  });

  it('counts a near-miss as answered without a second try', () => {
    const nearMiss = { type: 'checked', grade: { result: 'near-miss', hint: 'Case' } } as const;
    const state = reduce(reduce(playing(1), answered('water')), nearMiss);
    expect(state.phase).toBe('feedback');
    expect(reduce(state, next).phase).toBe('completing');
  });

  it('keeps a failed completion retryable and ends on results', () => {
    let state = reduce(reduce(reduce(playing(1), answered('Water')), correct), next);
    state = reduce(state, { type: 'failed', error: new Error('offline') });
    expect(state).toMatchObject({ phase: 'completing', error: expect.any(Error) });
    state = reduce(state, next);
    expect(state.error).toBeNull();
    const completion = { lessonId: 3, accuracy: 100, xpEarned: 10, totalXp: 10, level: 1 };
    state = reduce(state, { type: 'completed', completion: completion as never });
    expect(state).toMatchObject({ phase: 'results', completion });
    expect(reduce(state, next)).toBe(state);
  });

  it('records a load failure', () => {
    const error = new Error('404');
    expect(reduce(initialPlayerState, { type: 'failed', error })).toMatchObject({
      phase: 'loading',
      error,
    });
  });
});

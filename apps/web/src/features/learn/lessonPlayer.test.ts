import type { Item, LessonSession } from '@manabi/core';
import type { PlayerState } from './lessonPlayer';
import { initialPlayerState, lessonPlayerReducer as reduce } from './lessonPlayer';

// FR-046, FR-047, FR-168: every transition of the lesson player state machine.

const item = { id: 1, data: {} } as unknown as Item;
const session = (cards: number, exercises: number): LessonSession => ({
  id: 7,
  lessonId: 3,
  expiresAt: '2026-11-24T00:00:00.000Z',
  lessonTitle: 'Lesson',
  lessonType: 'vocabulary',
  sectionLevel: 'N5',
  plugin: 'ja',
  teachingCards: Array.from({ length: cards }, () => ({
    item,
    examples: [],
    words: [],
    strokeAnimation: false,
    facet: null,
    before: 0,
    refresher: false,
  })),
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

  describe('mid-lesson teaching cards (Product Spec section 5, #237)', () => {
    /** A kanji lesson: two meaning cards before exercise 0, two reading cards before exercise 2. */
    const kanji = (exercises = 4): LessonSession => {
      const base = session(4, exercises);
      return {
        ...base,
        lessonType: 'kanji',
        teachingCards: base.teachingCards.map((c, i) => ({
          ...c,
          item: { ...item, id: (i % 2) + 1 },
          facet: i < 2 ? 'meaning' : 'reading',
          before: i < 2 ? 0 : 2,
        })),
      };
    };
    const loaded = (s: LessonSession) => reduce(initialPlayerState, { type: 'loaded', session: s });
    const right = (state: PlayerState) =>
      reduce(reduce(reduce(state, answered('a')), correct), next);
    const miss = (state: PlayerState) => {
      const once = reduce(reduce(state, answered('x')), wrong);
      return reduce(reduce(reduce(once, answered('y')), wrong), next);
    };

    it('shows the cards placed before an exercise when it comes up, then plays on', () => {
      let state = reduce(loaded(kanji()), next);
      expect(state).toMatchObject({ phase: 'teaching', card: 0 });
      state = reduce(state, next);
      expect(state).toMatchObject({ phase: 'teaching', card: 1 });
      state = reduce(state, next);
      expect(state).toMatchObject({ phase: 'answering', card: 2, queue: [0, 1, 2, 3] });
      state = right(state);
      expect(state).toMatchObject({ phase: 'answering', queue: [1, 2, 3] });
      // After exercise 1, the reading cards come before exercise 2.
      state = right(state);
      expect(state).toMatchObject({ phase: 'teaching', card: 2, queue: [2, 3], step: 2 });
      expect(state.grade).toBeNull();
      state = reduce(state, next);
      expect(state).toMatchObject({ phase: 'teaching', card: 3 });
      state = reduce(state, next);
      expect(state).toMatchObject({ phase: 'answering', card: 4, queue: [2, 3] });
      state = right(right(state));
      expect(state.phase).toBe('completing');
      expect(state.responses).toEqual(Array.from({ length: 4 }, () => ({ attempts: ['a'] })));
    });

    it('records a miss before the card and replays it in the retry round without the cards again', () => {
      let state = reduce(reduce(reduce(loaded(kanji()), next), next), next);
      state = right(state);
      state = miss(state); // exercise 1, wrong twice: back at the end
      expect(state).toMatchObject({ phase: 'teaching', card: 2, queue: [2, 3, 1] });
      state = reduce(reduce(state, next), next);
      state = right(right(state));
      // The retry round: exercise 1 again, and no card comes back.
      expect(state).toMatchObject({ phase: 'answering', card: 4, queue: [1] });
      state = right(state);
      expect(state.phase).toBe('completing');
      expect(state.responses[1]).toEqual({ attempts: ['x', 'y'] });
    });

    it('shows a card placed after the last exercise before completing', () => {
      const s = kanji(2);
      let state = reduce(reduce(reduce(loaded(s), next), next), next);
      state = right(right(state));
      expect(state).toMatchObject({ phase: 'teaching', card: 2, queue: [] });
      state = reduce(reduce(state, next), next);
      expect(state.phase).toBe('completing');
    });

    it('shows a card placed after the last exercise before the retry round', () => {
      let state = reduce(reduce(reduce(loaded(kanji(2)), next), next), next);
      state = miss(right(state));
      expect(state).toMatchObject({ phase: 'teaching', card: 2, queue: [1] });
      state = reduce(reduce(state, next), next);
      expect(state).toMatchObject({ phase: 'answering', card: 4, queue: [1] });
      expect(right(state).phase).toBe('completing');
    });

    it('shows every card first in a session saved before #237 (all before 0)', () => {
      const old = kanji();
      old.teachingCards = old.teachingCards.map((c) => ({ ...c, facet: null, before: 0 }));
      let state = reduce(loaded(old), next);
      for (const card of [1, 2, 3]) {
        state = reduce(state, next);
        expect(state).toMatchObject({ phase: 'teaching', card });
      }
      state = reduce(state, next);
      expect(state).toMatchObject({ phase: 'answering', queue: [0, 1, 2, 3] });
      for (let i = 0; i < 4; i++) state = right(state);
      expect(state.phase).toBe('completing');
    });

    it('sorts cards into showing order', () => {
      const s = kanji();
      s.teachingCards = [...s.teachingCards].reverse();
      const state = loaded(s);
      expect(
        'teachingCards' in state.session! && state.session.teachingCards.map((c) => c.before),
      ).toEqual([0, 0, 2, 2]);
    });

    it('keeps a card before the same exercise when listening exercises are dropped (FR-135)', () => {
      const s = kanji();
      s.exercises[0] = { type: 'listen_choose', payload: {} };
      let state = reduce(loaded(s), { type: 'canSpeak', canSpeak: false });
      expect(state.session!.exercises).toHaveLength(3);
      expect(
        'teachingCards' in state.session! && state.session.teachingCards.map((c) => c.before),
      ).toEqual([0, 0, 1, 1]);
      state = reduce(reduce(reduce(state, next), next), next);
      state = right(state);
      expect(state).toMatchObject({ phase: 'teaching', card: 2, queue: [1, 2] });
    });

    it('drops a refresher whose item only a dropped listening exercise used (FR-135, #256)', () => {
      const s = session(1, 4);
      const earlier = { ...item, id: 9 };
      const kept = { ...item, id: 8 };
      s.exercises[1] = { type: 'listen_choose', payload: { options: [{ itemId: 9 }] } };
      s.exercises[2] = { type: 'test_echo', payload: { options: [{ itemId: 8 }] } };
      s.teachingCards.push(
        { ...s.teachingCards[0]!, item: earlier, before: 1, refresher: true },
        { ...s.teachingCards[0]!, item: kept, before: 2, refresher: true },
      );
      const state = reduce(loaded(s), { type: 'canSpeak', canSpeak: false });
      expect(
        'teachingCards' in state.session! &&
          state.session.teachingCards.map((c) => [c.item.id, c.before]),
      ).toEqual([
        [1, 0],
        [8, 1],
      ]);
    });

    it('ignores a late voice change once an exercise has been played', () => {
      let state = reduce(reduce(reduce(loaded(kanji()), next), next), next);
      state = right(right(state));
      expect(state.phase).toBe('teaching');
      expect(reduce(state, { type: 'canSpeak', canSpeak: false })).toBe(state);
    });
  });

  it('records a load failure', () => {
    const error = new Error('404');
    expect(reduce(initialPlayerState, { type: 'failed', error })).toMatchObject({
      phase: 'loading',
      error,
    });
  });
});

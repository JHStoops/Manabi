import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import { TEST_EXERCISE_TYPE } from '@manabi/core/src/testExerciseType';
import type * as TestType from '@manabi/core/src/testExerciseType';
import type * as LangJa from '@manabi/lang-ja';
import '../../i18n';
import { ApiContext, SessionProvider } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { registerExerciseRenderer } from '../exercises/registry';
import '../exercises/renderers';
import LessonPlayerPage from './LessonPlayerPage';

// FR-046, FR-114: the review session in the shared player.

jest.mock('@manabi/lang-ja', () => {
  const actual = jest.requireActual<typeof LangJa>('@manabi/lang-ja');
  const { testPlugin } = jest.requireActual<typeof TestType>('@manabi/core/src/testExerciseType');
  return { japanese: { ...actual.japanese, checkAnswer: testPlugin.checkAnswer } };
});

registerExerciseRenderer(TEST_EXERCISE_TYPE, () => import('../exercises/TestEchoRenderer'));

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

const exercise = (n: number) => ({
  type: TEST_EXERCISE_TYPE,
  payload: { prompt: `Type a${n}`, answer: `a${n}` },
  itemId: n,
  facet: 'meaning',
  plugin: 'ja',
  correct: null,
  retry: false,
});
const session = {
  id: 5,
  expiresAt: '2026-11-27T00:00:00.000Z',
  exercises: [exercise(1), exercise(2)],
};

function show(answers: jest.Mock, started: object = session) {
  const post = jest.fn((path: string, opts: { body: { index: number } }) =>
    path === '/api/v1/reviews/sessions' ? Promise.resolve(started) : answers(opts.body),
  );
  const api = { POST: post, GET: jest.fn(() => Promise.resolve({ settings: {} })) };
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>
        <SessionProvider>
          <MemoryRouter initialEntries={['/review/session']}>
            <Routes>
              <Route path="/review/session" element={<LessonPlayerPage review />} />
              <Route path="/review" element={<h1>Review tab</h1>} />
            </Routes>
          </MemoryRouter>
        </SessionProvider>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
  return post;
}

const button = (name: string) => screen.getByRole('button', { name });
async function answer(text: string) {
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: text } });
  fireEvent.click(button('Check'));
}

describe('review session', () => {
  it('gives a second try, saves the answer once and plays the server-queued retry', async () => {
    const answers = jest
      .fn()
      .mockResolvedValueOnce({ correct: false, stage: null, xpEarned: 0, retryIndex: 2 })
      .mockResolvedValue({ correct: true, stage: 2, xpEarned: 1, retryIndex: null });
    const post = show(answers);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));

    await answer('x');
    expect(screen.getByRole('status').textContent).toContain('Not quite, try once more.');
    expect(answers).not.toHaveBeenCalled(); // the first wrong answer is not final
    await answer('y');
    expect(screen.getByRole('status').textContent).toContain('Not quite. The answer is');
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(answers).toHaveBeenCalledTimes(1);
    expect(answers.mock.calls[0]![0]).toMatchObject({
      index: 0,
      response: { attempts: ['x', 'y'] },
    });
    expect(post).toHaveBeenCalledWith(
      '/api/v1/review-sessions/{id}/answers',
      expect.objectContaining({ params: { path: { id: '5' } } }),
    );

    fireEvent.click(button('Continue'));
    await answer('a2');
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await answer('a1'); // the retry of the first exercise, as a new index
    await screen.findByRole('button', { name: 'Continue' });
    expect(answers.mock.calls[2]![0]).toMatchObject({ index: 2 });
    fireEvent.click(button('Continue'));
    expect(await screen.findByRole('heading', { name: 'Review complete' })).toBeTruthy();
    expect(screen.getByText('Accuracy 50%')).toBeTruthy();
    expect(screen.getByText('+2 XP')).toBeTruthy();
  });

  it('can be stopped early; answers already given are kept by the server', async () => {
    const answers = jest
      .fn()
      .mockResolvedValue({ correct: true, stage: null, xpEarned: 0, retryIndex: null });
    show(answers);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await answer('a1');
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('link', { name: 'Leave lesson' }));
    expect(await screen.findByRole('heading', { name: 'Review tab' })).toBeTruthy();
    expect(answers).toHaveBeenCalledTimes(1);
  });

  it('skips exercises a resumed session already has answers for', async () => {
    const resumed = { ...session, exercises: [{ ...exercise(1), correct: true }, exercise(2)] };
    const answers = jest
      .fn()
      .mockResolvedValue({ correct: true, stage: null, xpEarned: 0, retryIndex: null });
    show(answers, resumed);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await answer('a2');
    await screen.findByRole('button', { name: 'Continue' });
    expect(answers.mock.calls[0]![0]).toMatchObject({ index: 1 });
  });
});

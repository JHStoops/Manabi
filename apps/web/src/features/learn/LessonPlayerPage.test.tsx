import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import type { Item, LessonSession } from '@manabi/core';
import { TEST_EXERCISE_TYPE } from '@manabi/core/src/testExerciseType';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { registerExerciseRenderer } from '../exercises/registry';
import LessonPlayerPage from './LessonPlayerPage';

// FR-046, FR-047, NFR-03, IF-03: the lesson player with the dummy test_echo exercise type.

// The player grades with the core test plugin: exact match is correct.
jest.mock('@manabi/lang-ja', () => ({
  japanese: jest.requireActual('@manabi/core/src/testExerciseType').testPlugin,
}));

registerExerciseRenderer(TEST_EXERCISE_TYPE, () => import('../exercises/TestEchoRenderer'));

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

const item = {
  id: 1,
  key: 'a',
  type: 'kana',
  data: { character: 'あ', romaji: 'a' },
} as unknown as Item;
const session: LessonSession = {
  id: 7,
  lessonId: 3,
  expiresAt: '2026-11-24T00:00:00.000Z',
  teachingCards: [{ item }],
  exercises: Array.from({ length: 10 }, (_, i) => ({
    type: TEST_EXERCISE_TYPE,
    payload: { prompt: `Type a${i}`, answer: `a${i}` },
  })),
};
const completion = { lessonId: 3, accuracy: 90, xpEarned: 12, totalXp: 12, level: 1, path: {} };

function show(
  post: jest.Mock = jest.fn((path: string) =>
    Promise.resolve(path === '/api/v1/lessons/{id}/sessions' ? session : completion),
  ),
) {
  const api = { POST: post };
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={['/lesson/3']}>
          <Routes>
            <Route path="/lesson/:lessonId" element={<LessonPlayerPage />} />
          </Routes>
        </MemoryRouter>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
  return api;
}

const button = (name: string) => screen.getByRole('button', { name });
const status = () => screen.getByRole('status').textContent;

/** Types into the exercise shown (the prompt names the answer) and presses Check. */
async function answer(text: string) {
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: text } });
  fireEvent.click(button('Check'));
}

async function startExercises() {
  fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
  expect(screen.getByText('あ')).toBeTruthy(); // the teaching card
  fireEvent.click(button('Next'));
}

describe('LessonPlayerPage', () => {
  it('counts wrong-then-right as correct and re-queues an exercise wrong twice', async () => {
    const api = show();
    await startExercises();

    await answer('nope');
    expect(status()).toBe('!Not quite, try once more.');
    expect(status()).not.toContain('a0'); // the answer is not revealed
    // The second try needs a new answer: Enter again cannot spend it on the same one.
    expect(button('Check').getAttribute('aria-disabled')).toBe('true');
    await answer('a0');
    expect(status()).toBe('✓Correct!');
    fireEvent.click(button('Continue'));

    await answer('x');
    await answer('y');
    expect(status()).toBe('✗Not quite. The answer is: a1');
    fireEvent.click(button('Continue'));

    for (let i = 2; i < 10; i++) {
      expect(screen.getByLabelText(`Type a${i}`)).toBeTruthy();
      await answer(`a${i}`);
      fireEvent.click(button('Continue'));
    }
    // FR-047: the miss comes back at the end.
    expect(screen.getByLabelText('Type a1')).toBeTruthy();
    expect(screen.getByRole('textbox')).toHaveProperty('value', '');
    await answer('a1');
    fireEvent.click(button('Continue'));

    expect(await screen.findByText('Accuracy 90%')).toBeTruthy();
    expect(screen.getByText('+12 XP')).toBeTruthy();
    expect(api.POST).toHaveBeenLastCalledWith('/api/v1/lesson-sessions/{id}/complete', {
      params: { path: { id: '7' } },
      body: {
        responses: [
          { attempts: ['nope', 'a0'] },
          { attempts: ['x', 'y'] },
          ...Array.from({ length: 8 }, (_, i) => ({ attempts: [`a${i + 2}`] })),
        ],
      },
      idempotencyKey: 'lesson-session-7',
    });
  });

  it('shows feedback without any network call', async () => {
    const api = show();
    await startExercises();
    expect(api.POST).toHaveBeenCalledTimes(1); // starting the session
    await answer('a0');
    expect(status()).toBe('✓Correct!');
    expect(api.POST).toHaveBeenCalledTimes(1);
  });

  it('completes a lesson by keyboard alone', async () => {
    show();
    const enter = () => fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    await screen.findByRole('button', { name: 'Start' });
    enter(); // start: focus is on the screen content
    expect(screen.getByText('New item 1 of 1')).toBeTruthy();
    enter();
    for (let i = 0; i < 10; i++) {
      const input = await screen.findByLabelText(`Type a${i}`);
      input.focus();
      fireEvent.change(input, { target: { value: `a${i}` } });
      enter(); // Enter in the field checks
      expect(document.activeElement).toBe(button('Continue'));
      enter(); // Enter on the focused Continue button
    }
    expect(await screen.findByText('Accuracy 90%')).toBeTruthy();
  });

  it('keeps the Check button unusable until there is an answer', async () => {
    show();
    await startExercises();
    await screen.findByRole('textbox');
    expect(button('Check').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button('Check'));
    expect(status()).toBe('');
  });

  it('treats an empty answer as none', async () => {
    show();
    await startExercises();
    const input = await screen.findByRole('textbox');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(button('Check').getAttribute('aria-disabled')).toBe('true');
  });

  it('shows an error when an answer cannot be graded', async () => {
    const broken = {
      ...session,
      teachingCards: [],
      exercises: [{ type: TEST_EXERCISE_TYPE, payload: { prompt: 'Broken' } }],
    };
    show(jest.fn(() => Promise.resolve(broken)));
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await answer('a');
    expect(screen.getByRole('alert').textContent).toMatch(/could not be checked/);
    expect(screen.getByRole('textbox')).toBeTruthy(); // the exercise stays
  });

  it('shows a load failure', async () => {
    show(jest.fn(() => Promise.reject(new TypeError('offline'))));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Cannot reach the server/);
    expect(screen.getByRole('link', { name: 'Leave lesson' })).toBeTruthy();
  });
});

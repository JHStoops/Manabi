import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import type { Item, LessonSession } from '@manabi/core';
import { TEST_EXERCISE_TYPE } from '@manabi/core/src/testExerciseType';
import type * as TestType from '@manabi/core/src/testExerciseType';
import type * as LangJa from '@manabi/lang-ja';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { registerExerciseRenderer } from '../exercises/registry';
import '../exercises/renderers';
import LessonPlayerPage from './LessonPlayerPage';

// FR-046, FR-047, NFR-03, IF-03: the lesson player with the dummy test_echo exercise type.

// The real ja plugin shows items; answers are graded like the core test plugin: exact match is
// correct.
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

const item = (id: number, type: string, data: object) =>
  ({ id, key: `k${id}`, type, data, overrides: {} }) as unknown as Item;
const kana = item(1, 'kana', { character: 'あ', script: 'hiragana', romaji: 'a' });
const session: LessonSession = {
  id: 7,
  lessonId: 3,
  expiresAt: '2026-11-24T00:00:00.000Z',
  lessonTitle: 'Vowels',
  lessonType: 'kana',
  sectionLevel: 'kana',
  plugin: 'ja',
  teachingCards: [{ item: kana }],
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
  it('introduces the lesson by title, type and items, then teaches a kana with romaji (FR-141)', async () => {
    const twoKana = {
      ...session,
      teachingCards: [
        { item: kana },
        { item: item(2, 'kana', { character: 'い', script: 'hiragana', romaji: 'i' }) },
      ],
    };
    show(jest.fn(() => Promise.resolve(twoKana)));
    expect(await screen.findByRole('heading', { name: 'Vowels' })).toBeTruthy();
    expect(screen.getByText('Kana')).toBeTruthy();
    expect(screen.getByText('This lesson teaches 2 new items.')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['あ', 'い']);

    fireEvent.click(button('Start'));
    expect(screen.getByText('あ').getAttribute('lang')).toBe('ja');
    expect(screen.getByText('Reading').nextSibling?.textContent).toBe('a');
    expect(screen.queryByText('Meaning')).toBeNull();
  });

  it('teaches a word with its reading and meaning, without romaji outside the kana section', async () => {
    const water = item(3, 'word', {
      written: '水',
      reading: 'みず',
      senses: [{ partsOfSpeech: ['n'], meanings: ['water'] }],
    });
    show(
      jest.fn(() =>
        Promise.resolve({
          ...session,
          lessonType: 'vocabulary',
          sectionLevel: 'N5',
          teachingCards: [{ item: water }],
        }),
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect(screen.getByText('水')).toBeTruthy();
    expect(screen.getByText('Reading').nextSibling?.textContent).toBe('みず');
    expect(screen.getByText('みず').getAttribute('lang')).toBe('ja');
    expect(screen.getByText('Meaning').nextSibling?.textContent).toBe('water');
  });

  it('refuses a course whose language plugin this app does not ship', async () => {
    show(jest.fn(() => Promise.resolve({ ...session, plugin: 'xx' })));
    expect((await screen.findByRole('alert')).textContent).toMatch(/cannot play this course/);
  });

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

  describe('audio (FR-135)', () => {
    const listening = { type: 'listen_choose', payload: {} };
    const withListening = { ...session, exercises: [listening, ...session.exercises] };
    const speakers = () => screen.queryAllByRole('button', { name: /Play audio/ });

    afterEach(() => {
      Object.assign(globalThis, { speechSynthesis: undefined });
    });

    it('shows no speaker buttons and skips listening exercises when the device has no voice', async () => {
      show(jest.fn(() => Promise.resolve(withListening)));
      fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
      expect(speakers()).toHaveLength(0);
      fireEvent.click(button('Next'));
      expect(await screen.findByLabelText('Type a0')).toBeTruthy(); // not the listening exercise
    });

    it('speaks the reading from the teaching card and the answer after feedback', async () => {
      const speak = jest.fn();
      Object.assign(globalThis, {
        speechSynthesis: {
          getVoices: () => [{ lang: 'ja-JP', name: 'Kyoko' }],
          addEventListener() {},
          removeEventListener() {},
          speak,
          cancel() {},
        },
        SpeechSynthesisUtterance: function (this: { text: string }, text: string) {
          this.text = text;
        },
      });
      const water = item(3, 'word', {
        written: '水',
        reading: 'みず',
        senses: [{ partsOfSpeech: ['n'], meanings: ['water'] }],
      });
      const typed = {
        type: 'typed_answer',
        payload: {
          prompt: 'Water',
          answerLanguage: 'target',
          accept: [{ text: 'みず', tiles: [{ surface: 'みず', base: '水', reading: 'みず' }] }],
        },
      };
      show(
        jest.fn(() =>
          Promise.resolve({
            ...session,
            lessonType: 'vocabulary',
            sectionLevel: 'N5',
            teachingCards: [{ item: water }],
            exercises: [typed],
          }),
        ),
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
      expect(speakers()).toHaveLength(2); // normal and slow
      fireEvent.click(speakers()[0]!);
      expect(speak.mock.calls[0]![0]).toMatchObject({ text: 'みず', rate: 1 });
      fireEvent.click(screen.getByRole('button', { name: 'Play audio slowly' }));
      expect(speak.mock.calls[1]![0]).toMatchObject({ rate: 0.75 });

      fireEvent.click(button('Next'));
      fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'みず' } });
      fireEvent.click(button('Check'));
      fireEvent.click(screen.getAllByRole('button', { name: 'Play audio' })[0]!);
      expect(speak).toHaveBeenCalledTimes(3);
      expect(speak.mock.calls[2]![0]).toMatchObject({ text: 'みず' });
    });
  });
});

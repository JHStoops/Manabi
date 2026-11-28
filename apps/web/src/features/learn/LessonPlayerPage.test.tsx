import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import type { Item, LessonSession, TestOutSession } from '@manabi/core';
import { TEST_EXERCISE_TYPE } from '@manabi/core/src/testExerciseType';
import type * as TestType from '@manabi/core/src/testExerciseType';
import type * as LangJa from '@manabi/lang-ja';
import '../../i18n';
import { ApiContext, SessionProvider } from '../../state/session';
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

// FR-071: Hanzi Writer needs a real canvas; the stub names what it would animate.
jest.mock('../strokes/StrokeCanvas', () => ({
  StrokeCanvas: (props: { itemKey: string; character: string; mode: string }) => (
    <div data-testid="strokes">{`${props.mode} ${props.character} ${props.itemKey}`}</div>
  ),
}));

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
  teachingCards: [
    {
      item: kana,
      examples: [],
      words: [],
      strokeAnimation: false,
      facet: null,
      before: 0,
      refresher: false,
    },
  ],
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
  entry = '/lesson/3',
) {
  const api = { POST: post, GET: jest.fn(() => Promise.resolve({ settings: {} })) };
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>
        <SessionProvider>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/lesson/:lessonId" element={<LessonPlayerPage />} />
              <Route path="/unit/:unitId/test-out" element={<LessonPlayerPage />} />
              <Route
                path="/authoring/lessons/:lessonId/preview"
                element={<LessonPlayerPage preview />}
              />
            </Routes>
          </MemoryRouter>
        </SessionProvider>
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
        {
          item: kana,
          examples: [],
          words: [],
          strokeAnimation: false,
          facet: null,
          before: 0,
          refresher: false,
        },
        {
          item: item(2, 'kana', { character: 'い', script: 'hiragana', romaji: 'i' }),
          examples: [],
          words: [],
          strokeAnimation: false,
          facet: null,
          before: 0,
        },
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
          teachingCards: [
            {
              item: water,
              examples: [],
              words: [],
              strokeAnimation: false,
              facet: null,
              before: 0,
            },
          ],
        }),
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect(screen.getByText('水')).toBeTruthy();
    expect(screen.getByText('Reading').nextSibling?.textContent).toBe('みず');
    expect(screen.getByText('みず').getAttribute('lang')).toBe('ja');
    expect(screen.getByText('Meaning').nextSibling?.textContent).toBe('water');
  });

  it("animates a kanji's strokes and lists the words that use it (Product Spec section 5)", async () => {
    const rest = item(5, 'kanji', {
      character: '休',
      meanings: ['rest'],
      onReadings: ['キュウ'],
      kunReadings: ['やす.む'],
      strokeCount: 6,
      components: [],
    });
    const holiday = item(6, 'word', {
      written: '休み',
      reading: 'やすみ',
      senses: [{ partsOfSpeech: ['n'], meanings: ['holiday'] }],
    });
    show(
      jest.fn(() =>
        Promise.resolve({
          ...session,
          lessonType: 'kanji',
          sectionLevel: 'N5',
          teachingCards: [
            {
              item: rest,
              examples: [],
              words: [holiday],
              strokeAnimation: true,
              facet: null,
              before: 0,
            },
            {
              item: { ...rest, id: 7 },
              examples: [],
              words: [],
              strokeAnimation: false,
              facet: null,
              before: 0,
            },
          ],
        }),
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect((await screen.findByTestId('strokes')).textContent).toBe('animate 休 k5');
    const words = screen.getByRole('region', { name: 'Words with 休' });
    expect(words.textContent).toContain('休み');
    expect(words.textContent).toContain('やすみ');
    expect(words.textContent).toContain('holiday');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'New item 2 of 2' })).toBeTruthy();
    expect(screen.queryByTestId('strokes')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Words with 休' })).toBeNull();
  });

  it("shows a kanji's reading card mid-lesson, keeping progress and the retry round (Product Spec 5, #237)", async () => {
    const rest = item(5, 'kanji', {
      character: '休',
      meanings: ['rest'],
      onReadings: ['キュウ'],
      kunReadings: ['やす.む'],
      strokeCount: 6,
      components: [],
    });
    const holiday = item(6, 'word', {
      written: '休み',
      reading: 'やすみ',
      senses: [{ partsOfSpeech: ['n'], meanings: ['holiday'] }],
    });
    const card = { item: rest, examples: [] };
    const api = show(
      jest.fn((path: string) =>
        Promise.resolve(
          path === '/api/v1/lessons/{id}/sessions'
            ? {
                ...session,
                lessonType: 'kanji',
                sectionLevel: 'N5',
                teachingCards: [
                  { ...card, words: [], strokeAnimation: true, facet: 'meaning', before: 0 },
                  {
                    ...card,
                    words: [holiday],
                    strokeAnimation: false,
                    facet: 'reading',
                    before: 2,
                  },
                ],
              }
            : completion,
        ),
      ),
    );
    // The intro names the kanji once, though it has two cards.
    expect(await screen.findByText('This lesson teaches 1 new items.')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['休']);
    fireEvent.click(button('Start'));
    // The meaning card: kanji, meaning and strokes; no reading or words yet.
    expect(screen.getByRole('heading', { name: 'New item 1 of 1' })).toBeTruthy();
    expect(screen.getByText('Meaning').nextSibling?.textContent).toBe('rest');
    expect(screen.queryByText('Reading')).toBeNull();
    expect((await screen.findByTestId('strokes')).textContent).toBe('animate 休 k5');
    expect(screen.queryByRole('region', { name: 'Words with 休' })).toBeNull();
    fireEvent.click(button('Next'));

    const progress = () => Number(screen.getByLabelText('Lesson progress').getAttribute('value'));
    await answer('a0');
    fireEvent.click(button('Continue'));
    await answer('x'); // exercise 1, wrong twice: it comes back at the end
    await answer('y');
    fireEvent.click(button('Continue'));
    expect(progress()).toBe(1);

    // The reading card, after the meaning exercises and before the rest.
    const heading = screen.getByRole('heading', { name: 'How to read 休' });
    expect(heading.querySelector('[lang="ja"]')?.textContent).toBe('休');
    expect(document.activeElement).toBe(screen.getByText('Words with 休').closest('[tabindex]'));
    expect(screen.getByText('Reading').nextSibling?.textContent).toBe('やす.む');
    expect(screen.queryByText('Meaning')).toBeNull();
    expect(screen.queryByTestId('strokes')).toBeNull();
    expect(screen.getByRole('region', { name: 'Words with 休' }).textContent).toContain('やすみ');
    expect(progress()).toBe(1);
    fireEvent.click(button('Next'));

    for (let i = 2; i < 10; i++) {
      expect(screen.getByLabelText(`Type a${i}`)).toBeTruthy();
      await answer(`a${i}`);
      fireEvent.click(button('Continue'));
    }
    // The retry round: the miss again, with no card in between.
    expect(screen.getByLabelText('Type a1')).toBeTruthy();
    await answer('a1');
    fireEvent.click(button('Continue'));
    expect(await screen.findByText('Accuracy 90%')).toBeTruthy();
    expect(api.POST).toHaveBeenLastCalledWith(
      '/api/v1/lesson-sessions/{id}/complete',
      expect.objectContaining({
        body: {
          responses: [
            { attempts: ['a0'] },
            { attempts: ['x', 'y'] },
            ...Array.from({ length: 8 }, (_, i) => ({ attempts: [`a${i + 2}`] })),
          ],
        },
      }),
    );
  });

  it('shows a refresher card for an earlier item mid-lesson, labelled as a refresher (FR-041, #256)', async () => {
    const i = item(2, 'kana', { character: 'い', script: 'hiragana', romaji: 'i' });
    const newCard = session.teachingCards[0]!;
    show(
      jest.fn(() =>
        Promise.resolve({
          ...session,
          teachingCards: [newCard, { ...newCard, item: i, before: 2, refresher: true }],
        }),
      ),
    );
    // The intro lists only the new item as taught, and counts the refresher apart.
    expect(await screen.findByText('This lesson teaches 1 new items.')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['あ']);
    expect(screen.getByText('It also brings back 1 item from an earlier lesson.')).toBeTruthy();
    fireEvent.click(button('Start'));
    expect(screen.getByRole('heading', { name: 'New item 1 of 1' })).toBeTruthy();
    fireEvent.click(button('Next'));

    await answer('a0');
    fireEvent.click(button('Continue'));
    await answer('a1');
    fireEvent.click(button('Continue'));
    // Before the third exercise: the refresher, with its term in its own language.
    const heading = screen.getByRole('heading', { name: 'Refresher: い' });
    expect(heading.querySelector('[lang="ja"]')?.textContent).toBe('い');
    expect(screen.getByText('Reading').nextSibling?.textContent).toBe('i');
    expect(screen.queryByRole('heading', { name: /New item/ })).toBeNull();
    fireEvent.click(button('Next'));
    expect(screen.getByLabelText('Type a2')).toBeTruthy();
  });

  it('shows the example sentence and its translation on a card that has one, and none otherwise (FR-041)', async () => {
    const water = item(3, 'word', {
      written: '水',
      reading: 'みず',
      senses: [{ partsOfSpeech: ['n'], meanings: ['water'] }],
    });
    const example = {
      text: '水をください。',
      translation: 'Water, please.',
      tiles: [{ surface: '水', base: '水', reading: 'みず' }],
    };
    show(
      jest.fn(() =>
        Promise.resolve({
          ...session,
          lessonType: 'vocabulary',
          sectionLevel: 'N5',
          teachingCards: [
            {
              item: water,
              examples: [example],
              words: [],
              strokeAnimation: false,
              facet: null,
              before: 0,
            },
            {
              item: { ...water, id: 4 },
              examples: [],
              words: [],
              strokeAnimation: false,
              facet: null,
              before: 0,
            },
          ],
        }),
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect(screen.getByText('Example')).toBeTruthy();
    expect(screen.getByText('水をください。').getAttribute('lang')).toBe('ja');
    expect(screen.getByText('Water, please.')).toBeTruthy();
    fireEvent.click(button('Next'));
    expect(screen.queryByText('Example')).toBeNull();
  });

  it('teaches a grammar point with its pattern, meaning, formation table and two examples (Product Spec 6)', async () => {
    const point = item(4, 'grammar', {
      pattern: 'Verb-te + ください',
      meaning: 'please do',
      formation: [{ wordType: 'Verb', form: 'te-form + ください', example: '見てください' }],
    });
    const example = (text: string) => ({ text, translation: `${text} (en)`, tiles: [] });
    show(
      jest.fn(() =>
        Promise.resolve({
          ...session,
          lessonType: 'grammar',
          sectionLevel: 'N5',
          teachingCards: [
            {
              item: point,
              examples: [example('見てください。'), example('来てください。')],
              words: [],
              strokeAnimation: false,
              facet: null,
              before: 0,
            },
          ],
        }),
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect(screen.getByText('Verb-te + ください')).toBeTruthy();
    expect(screen.getByText('Meaning').nextSibling?.textContent).toBe('please do');
    const table = screen.getByRole('table', { name: 'Formation' });
    expect(table.textContent).toBe(
      'FormationWord typeFormExampleVerbte-form + ください見てください',
    );
    expect(screen.getAllByText('Example')).toHaveLength(3);
    expect(screen.getByText('来てください。 (en)')).toBeTruthy();
  });

  it('plays a preview without recording a completion (FR-224)', async () => {
    const preview: Partial<LessonSession> = { ...session };
    delete preview.id;
    delete preview.expiresAt;
    const post = jest.fn(() => Promise.resolve(preview));
    show(post, '/authoring/lessons/3/preview');
    await startExercises();
    await answer('wrong');
    await answer('still wrong');
    fireEvent.click(button('Continue'));
    for (let i = 1; i < 10; i++) {
      await answer(`a${i}`);
      fireEvent.click(button('Continue'));
    }
    await answer('a0'); // the retry round
    fireEvent.click(button('Continue'));

    expect(await screen.findByText('Accuracy 90%')).toBeTruthy();
    expect(screen.getByText('Preview: nothing is recorded.')).toBeTruthy();
    expect(post.mock.calls).toEqual([
      ['/api/v1/authoring/lessons/{id}/preview', { params: { path: { id: '3' } }, body: {} }],
    ]);
    expect(screen.getByRole('link', { name: 'Done' }).getAttribute('href')).toBe(
      '/authoring/lessons/3',
    );
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
    expect(screen.getByTestId('confetti')).toBeTruthy(); // FR-167: motion is on by default
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
    const speakers = () => screen.queryAllByRole('button', { name: /^Play / });

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
            teachingCards: [
              {
                item: water,
                examples: [],
                words: [],
                strokeAnimation: false,
                facet: null,
                before: 0,
              },
            ],
            exercises: [typed],
          }),
        ),
      );
      // FR-130: the word's server clip is tried first; here it cannot play (NFR-23).
      const clips: string[] = [];
      Object.assign(globalThis, {
        Audio: function (this: { play: () => Promise<void> }, src: string) {
          clips.push(src);
          this.play = () => Promise.reject(new Error('503'));
        },
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
      expect(speakers()).toHaveLength(2); // normal and slow
      fireEvent.click(speakers()[0]!);
      await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
      expect(speak.mock.calls[0]![0]).toMatchObject({ text: 'みず', rate: 1 });
      expect(clips).toEqual([`/api/v1/media/audio/item/${water.id}`]);
      fireEvent.click(screen.getByRole('button', { name: 'Play word slowly' }));
      await waitFor(() => expect(speak).toHaveBeenCalledTimes(2));
      expect(speak.mock.calls[1]![0]).toMatchObject({ rate: 0.75 });

      fireEvent.click(button('Next'));
      fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'みず' } });
      fireEvent.click(button('Check'));
      fireEvent.click(screen.getByRole('button', { name: 'Play answer' }));
      expect(speak).toHaveBeenCalledTimes(3);
      expect(speak.mock.calls[2]![0]).toMatchObject({ text: 'みず' });
    });
  });
});

// FR-024: the unit test-out, played by the same player.
describe('LessonPlayerPage test-out', () => {
  const testOut: TestOutSession = {
    id: 9,
    unitId: 5,
    unitTitle: 'Greetings',
    expiresAt: '2026-11-24T00:00:00.000Z',
    sectionLevel: 'N5',
    plugin: 'ja',
    exercises: Array.from({ length: 20 }, (_, i) => ({
      type: TEST_EXERCISE_TYPE,
      payload: { prompt: `Type t${i}`, answer: `t${i}` },
    })),
  };

  async function play(passed: boolean) {
    const result = { unitId: 5, passed, accuracy: passed ? 100 : 80, totalXp: 30, level: 1 };
    const api = show(
      jest.fn((path: string) =>
        Promise.resolve(
          path === '/api/v1/units/{id}/test-out'
            ? testOut
            : { ...result, xpEarned: passed ? 30 : 0, path: {} },
        ),
      ),
      '/unit/5/test-out',
    );
    expect(await screen.findByRole('heading', { name: 'Test out of Greetings' })).toBeTruthy();
    expect(screen.getByText(/Answer 20 exercises\. Get 85% right/)).toBeTruthy();
    fireEvent.click(button('Start'));
    for (let i = 0; i < 20; i++) {
      await answer(`t${i}`);
      fireEvent.click(button('Continue'));
    }
    await screen.findByRole('link', { name: 'Done' });
    return api;
  }

  it('starts from the unit, completes with its own key, and shows a pass', async () => {
    const api = await play(true);
    expect(api.POST).toHaveBeenCalledWith('/api/v1/units/{id}/test-out', {
      params: { path: { id: '5' } },
      body: {},
    });
    expect(api.POST).toHaveBeenLastCalledWith('/api/v1/test-out-sessions/{id}/complete', {
      params: { path: { id: '9' } },
      body: { responses: testOut.exercises.map((_, i) => ({ attempts: [`t${i}`] })) },
      idempotencyKey: 'test-out-session-9',
    });
    expect(screen.getByRole('heading', { name: 'Unit complete!' })).toBeTruthy();
    expect(screen.getByText('Accuracy 100%')).toBeTruthy();
    expect(screen.getByText('+30 XP')).toBeTruthy();
  });

  it('shows a fail with the pass mark', async () => {
    await play(false);
    expect(screen.getByRole('heading', { name: /you need 85% to pass/ })).toBeTruthy();
    expect(screen.getByText('Accuracy 80%')).toBeTruthy();
  });
});

// FR-054, Product Spec section 4: "my answer should be accepted" on a wrong answer's feedback bar.
describe('LessonPlayerPage answer reports', () => {
  // The dummy type grades against `answer`; an `accept` list makes it reportable like EX-04.
  const typed = (i: number) => ({
    type: TEST_EXERCISE_TYPE,
    payload: { prompt: `Type a${i}`, answer: `a${i}`, accept: [{ text: `a${i}`, tiles: [] }] },
  });
  const withAccept = { ...session, exercises: session.exercises.map((_, i) => typed(i)) };

  function respond(start: object, report: () => Promise<unknown> = () => Promise.resolve({})) {
    return jest.fn((path: string) =>
      path === '/api/v1/answer-reports'
        ? report()
        : Promise.resolve(path.endsWith('/sessions') || path.endsWith('/preview') ? start : {}),
    );
  }

  async function missTwice() {
    await startExercises();
    await answer('nope');
    expect(screen.queryByRole('button', { name: 'My answer should be accepted' })).toBeNull();
    await answer('still nope');
  }

  it('reports the final wrong answer with the session and exercise, once', async () => {
    const api = show(respond(withAccept));
    await missTwice();
    fireEvent.click(button('My answer should be accepted'));
    expect(await screen.findByText('Thanks! An author will look at your answer.')).toBeTruthy();
    expect(api.POST).toHaveBeenCalledWith('/api/v1/answer-reports', {
      body: {
        session: { kind: 'lesson', id: 7 },
        exercise: typed(0),
        answer: 'still nope',
      },
    });
    expect(screen.queryByRole('button', { name: 'My answer should be accepted' })).toBeNull();
    // The focused button is gone, so focus moves to Continue.
    expect(document.activeElement).toBe(button('Continue'));

    // The next exercise starts without a report.
    fireEvent.click(button('Continue'));
    await answer('a1');
    expect(screen.queryByText('Thanks! An author will look at your answer.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'My answer should be accepted' })).toBeNull();
  });

  it('says why a report failed and lets the learner try again', async () => {
    const failing = jest
      .fn<Promise<unknown>, []>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({});
    show(respond(withAccept, failing));
    await missTwice();
    fireEvent.click(button('My answer should be accepted'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(button('My answer should be accepted'));
    expect(await screen.findByText('Thanks! An author will look at your answer.')).toBeTruthy();
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('offers no report on exercises without an accept list', async () => {
    show(respond(session));
    await missTwice();
    expect(screen.getByText(/The answer is: a0/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'My answer should be accepted' })).toBeNull();
  });

  it('offers no report in a preview, which has no session', async () => {
    const preview: Partial<LessonSession> = { ...withAccept };
    delete preview.id;
    show(respond(preview), '/authoring/lessons/3/preview');
    await missTwice();
    expect(screen.getByText(/The answer is: a0/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'My answer should be accepted' })).toBeNull();
  });
});

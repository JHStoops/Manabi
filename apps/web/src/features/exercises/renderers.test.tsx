import { fireEvent, render, screen, within } from '@testing-library/react';
import { CHOICE_TYPE, gradeResponse, MATCH_PAIRS_TYPE, WORD_BANK_TYPE } from '@manabi/core';
import type { Exercise, LanguagePlugin } from '@manabi/core';
import '../../i18n';
import { ExerciseRendererHarness } from './ExerciseRendererHarness';
import './renderers';

// FR-042 (EX-01 to EX-03) and IF-03: the registered renderers report answers the shared grader
// accepts, by tap and by keyboard, with tap targets of at least 44 px.

const plugin = {} as LanguagePlugin;

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

function renderExercise(exercise: Exercise) {
  const onAnswer = jest.fn();
  render(<ExerciseRendererHarness exercise={exercise} onAnswer={onAnswer} />);
  const grade = () =>
    gradeResponse(exercise, { attempts: [onAnswer.mock.lastCall?.[0]] }, plugin).result;
  return { onAnswer, grade };
}

const choice: Exercise = {
  type: CHOICE_TYPE,
  payload: {
    prompt: '水',
    options: [{ text: 'fire' }, { text: 'water' }, { text: 'tree' }, { text: 'gold' }],
    correct: 1,
  },
};

describe('EX-01 choice renderer', () => {
  it('selects an option by click', async () => {
    const { onAnswer, grade } = renderExercise(choice);
    const water = await screen.findByRole('button', { name: 'water' });
    fireEvent.click(water);
    expect(onAnswer).toHaveBeenLastCalledWith(1);
    expect(water.getAttribute('aria-pressed')).toBe('true');
    expect(grade()).toBe('correct');
    expect(getComputedStyle(water).minHeight).toBe('44px');
  });

  it('selects options with keys 1 to 4 and ignores other keys', async () => {
    const { onAnswer, grade } = renderExercise(choice);
    await screen.findByRole('button', { name: 'gold' });
    fireEvent.keyDown(window, { key: '5' });
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: '4' });
    expect(onAnswer).toHaveBeenLastCalledWith(3);
    expect(grade()).toBe('wrong');
    fireEvent.keyDown(window, { key: '2' });
    expect(onAnswer).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole('button', { name: 'water' }).getAttribute('aria-pressed')).toBe('true');
  });
});

const kana = ['あ', 'い', 'う', 'え', 'お'];
const romaji = ['a', 'i', 'u', 'e', 'o'];
const matchPairs: Exercise = {
  type: MATCH_PAIRS_TYPE,
  payload: { pairs: kana.map((term, i) => ({ term, match: romaji[i] })) },
};

describe('EX-02 match pairs renderer', () => {
  it('retries wrong pairings and completes after 5 correct pairs', async () => {
    const { onAnswer, grade } = renderExercise(matchPairs);
    const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
    await screen.findByRole('button', { name: 'あ' });

    tap('あ');
    tap('i');
    expect(screen.getByRole('status').textContent).toBe('Not a pair. Try again.');
    // Either side can be tapped first; a matched pair can no longer be tapped.
    tap('i');
    tap('い');
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('button', { name: /い/ }).getAttribute('aria-disabled')).toBe('true');
    kana.forEach((term, i) => {
      if (i === 1) return;
      expect(onAnswer).not.toHaveBeenCalled();
      tap(term);
      tap(romaji[i]!);
    });
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(grade()).toBe('correct');
  });
});

const tile = (surface: string) => ({ surface, base: surface, reading: surface });
const wordBank: Exercise = {
  type: WORD_BANK_TYPE,
  payload: {
    prompt: 'I am a student',
    answer: { text: '私は学生です', tiles: [tile('私は'), tile('学生'), tile('です')] },
    distractors: [tile('先生')],
    acceptedOrders: [[0, 1, 2]],
  },
};

describe('EX-03 word bank renderer', () => {
  const answerRow = () => within(screen.getByRole('group', { name: 'Your answer' }));
  const bankRow = () => within(screen.getByRole('group', { name: 'Word bank' }));
  const answerText = () =>
    answerRow()
      .queryAllByRole('button')
      .map((b) => b.textContent);

  it('adds, removes and reorders tiles by tap', async () => {
    const { onAnswer, grade } = renderExercise(wordBank);
    await screen.findByRole('group', { name: 'Word bank' });
    const tapBank = (name: string) => fireEvent.click(bankRow().getByRole('button', { name }));

    tapBank('学生');
    tapBank('私は');
    tapBank('です');
    expect(answerText()).toEqual(['学生', '私は', 'です']);
    expect(grade()).toBe('wrong');
    // A used bank tile does nothing; tapping an answer tile puts it back.
    tapBank('学生');
    fireEvent.click(answerRow().getByRole('button', { name: '学生' }));
    expect(answerText()).toEqual(['私は', 'です']);
    tapBank('学生');
    expect(answerText()).toEqual(['私は', 'です', '学生']);
    fireEvent.click(answerRow().getByRole('button', { name: 'です' }));
    tapBank('です');
    expect(answerText()).toEqual(['私は', '学生', 'です']);
    expect(onAnswer).toHaveBeenLastCalledWith([0, 1, 2]);
    expect(grade()).toBe('correct');
  });

  it('adds, removes and reorders tiles by keyboard, keeping focus', async () => {
    const { onAnswer, grade } = renderExercise(wordBank);
    await screen.findByRole('group', { name: 'Word bank' });
    const press = (element: HTMLElement, key: string) => {
      element.focus();
      fireEvent.keyDown(element, { key });
      // Native buttons click on Enter and Space; jsdom does not, so click as the browser would.
      if (key === 'Enter') fireEvent.click(element);
    };

    press(bankRow().getByRole('button', { name: 'です' }), 'Enter');
    press(bankRow().getByRole('button', { name: '私は' }), 'Enter');
    press(bankRow().getByRole('button', { name: '学生' }), 'Enter');
    expect(answerText()).toEqual(['です', '私は', '学生']);

    press(answerRow().getByRole('button', { name: 'です' }), 'ArrowRight');
    expect(answerText()).toEqual(['私は', 'です', '学生']);
    expect(document.activeElement?.textContent).toBe('です');
    press(answerRow().getByRole('button', { name: 'です' }), 'ArrowRight');
    press(answerRow().getByRole('button', { name: 'です' }), 'ArrowRight');
    expect(answerText()).toEqual(['私は', '学生', 'です']);
    expect(grade()).toBe('correct');

    press(answerRow().getByRole('button', { name: '私は' }), 'ArrowLeft');
    expect(answerText()).toEqual(['私は', '学生', 'です']);
    press(answerRow().getByRole('button', { name: '学生' }), 'Enter');
    expect(answerText()).toEqual(['私は', 'です']);
    expect(document.activeElement).toBe(bankRow().getByRole('button', { name: '学生' }));
    expect(onAnswer).toHaveBeenLastCalledWith([0, 2]);
  });
});

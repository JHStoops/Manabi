import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  CHOICE_TYPE,
  FILL_BLANK_TYPE,
  gradeResponse,
  MATCH_PAIRS_TYPE,
  REORDER_TYPE,
  TYPED_ANSWER_TYPE,
  WORD_BANK_TYPE,
} from '@manabi/core';
import type { Exercise } from '@manabi/core';
import { japanese as plugin } from '@manabi/lang-ja';
import '../../i18n';
import { ExerciseRendererHarness } from './ExerciseRendererHarness';
import './renderers';

// FR-042 (EX-01 to EX-06) and IF-03: the registered renderers report answers the shared grader
// accepts, by tap and by keyboard, with tap targets of at least 44 px.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

function renderExercise(exercise: Exercise) {
  const onAnswer = jest.fn();
  render(<ExerciseRendererHarness exercise={exercise} plugin={plugin} onAnswer={onAnswer} />);
  const result = () => gradeResponse(exercise, { attempts: [onAnswer.mock.lastCall?.[0]] }, plugin);
  const grade = () => result().result;
  return { onAnswer, grade, result };
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

const typed = (answerLanguage: 'target' | 'base', prompt: string, text: string): Exercise => ({
  type: TYPED_ANSWER_TYPE,
  payload: { prompt, answerLanguage, accept: [{ text, tiles: [] }] },
});

describe('EX-04 typed answer renderer', () => {
  it('converts romaji to kana in a target-language answer', async () => {
    const { onAnswer, grade } = renderExercise(typed('target', 'Type the reading of 水', 'みず'));
    const input = (await screen.findByRole('textbox', {
      name: 'Type the reading of 水',
    })) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'mizu' } });
    expect(input.value).toBe('みず');
    expect(onAnswer).toHaveBeenLastCalledWith('みず');
    expect(grade()).toBe('correct');
    expect(getComputedStyle(input).minHeight).toBe('44px');
  });

  it('keeps an English answer as typed and gives the spelling note on a near-miss', async () => {
    const { onAnswer, result } = renderExercise(typed('base', 'What does 水 mean?', 'water'));
    const input = (await screen.findByRole('textbox', {
      name: 'What does 水 mean?',
    })) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'watr' } });
    expect(input.value).toBe('watr');
    expect(onAnswer).toHaveBeenLastCalledWith('watr');
    expect(result()).toEqual({ result: 'near-miss', hint: 'Watch your spelling' });
    fireEvent.change(input, { target: { value: 'The Water' } });
    expect(result()).toEqual({ result: 'correct' });
  });
});

const fillBlank = (options?: string[]): Exercise => ({
  type: FILL_BLANK_TYPE,
  payload: {
    prompt: 'I am a student',
    before: '私',
    after: '学生です',
    accept: [{ text: 'は', tiles: [tile('は')] }],
    ...(options && { options }),
  },
});

describe('EX-05 fill the blank renderer', () => {
  it('fills a chosen blank into the sentence', async () => {
    const { onAnswer, grade } = renderExercise(fillBlank(['を', 'は', 'に']));
    const wa = await screen.findByRole('button', { name: 'は' });
    fireEvent.click(screen.getByRole('button', { name: 'を' }));
    expect(onAnswer).toHaveBeenLastCalledWith('を');
    expect(grade()).toBe('wrong');
    fireEvent.click(wa);
    expect(wa.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('私', { exact: false }).textContent).toBe('私は学生です');
    expect(grade()).toBe('correct');
    expect(getComputedStyle(wa).minHeight).toBe('44px');
  });

  it('types a blank with romaji-to-kana input', async () => {
    const { onAnswer, grade } = renderExercise(fillBlank());
    const input = (await screen.findByRole('textbox', {
      name: 'Missing word',
    })) as HTMLInputElement;
    expect(screen.queryByRole('button')).toBeNull();
    fireEvent.change(input, { target: { value: 'ha' } });
    expect(input.value).toBe('は');
    expect(onAnswer).toHaveBeenLastCalledWith('は');
    expect(grade()).toBe('correct');
  });
});

const reorder: Exercise = {
  type: REORDER_TYPE,
  payload: {
    prompt: 'I drink coffee every morning',
    answer: {
      text: '私は毎朝コーヒーを飲みます',
      tiles: [tile('私は'), tile('毎朝'), tile('コーヒーを'), tile('飲みます')],
    },
    acceptedOrders: [
      [0, 1, 2, 3],
      [1, 0, 2, 3],
    ],
  },
};

describe('EX-06 reorder renderer', () => {
  // Math.random 0 makes the shuffle [1, 2, 3, 0]: 毎朝 コーヒーを 飲みます 私は.
  beforeEach(() => jest.spyOn(Math, 'random').mockReturnValue(0));
  afterEach(() => jest.restoreAllMocks());
  const chunks = () =>
    within(screen.getByRole('group', { name: 'Sentence pieces' }))
      .getAllByRole('button')
      .map((b) => b.textContent);
  // Each chunk is named with its position, e.g. "私は, 4 of 4".
  const chunk = (text: string) => screen.getByRole('button', { name: new RegExp(`^${text},`) });

  it('starts shuffled and reports the order, which is the answer', async () => {
    const { onAnswer, grade } = renderExercise(reorder);
    await screen.findByRole('group', { name: 'Sentence pieces' });
    expect(chunks()).toEqual(['毎朝', 'コーヒーを', '飲みます', '私は']);
    expect(onAnswer).toHaveBeenLastCalledWith([1, 2, 3, 0]);
    expect(grade()).toBe('wrong');
    expect(getComputedStyle(chunk('私は')).minHeight).toBe('44px');
  });

  it('moves a focused chunk with the arrow keys, keeping focus, to any accepted order', async () => {
    const { onAnswer, grade } = renderExercise(reorder);
    await screen.findByRole('group', { name: 'Sentence pieces' });
    const press = (name: string, key: string) => {
      chunk(name).focus();
      fireEvent.keyDown(chunk(name), { key });
    };

    press('私は', 'ArrowRight');
    expect(chunks()).toEqual(['毎朝', 'コーヒーを', '飲みます', '私は']);
    press('私は', 'ArrowLeft');
    press('私は', 'ArrowLeft');
    expect(document.activeElement).toBe(chunk('私は'));
    expect(chunk('私は').getAttribute('aria-label')).toBe('私は, 2 of 4');
    expect(chunks()).toEqual(['毎朝', '私は', 'コーヒーを', '飲みます']);
    expect(onAnswer).toHaveBeenLastCalledWith([1, 0, 2, 3]);
    expect(grade()).toBe('correct');
    press('私は', 'ArrowLeft');
    expect(chunks()).toEqual(['私は', '毎朝', 'コーヒーを', '飲みます']);
    expect(grade()).toBe('correct');
  });

  it('drags a chunk past each target middle, never swapping back under a wide target', async () => {
    const { onAnswer, grade } = renderExercise(reorder);
    await screen.findByRole('group', { name: 'Sentence pieces' });
    // jsdom has no layout or PointerEvent: lay the chunks out in one row with these widths.
    window.PointerEvent ??= class extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    } as unknown as typeof PointerEvent;
    Element.prototype.setPointerCapture = jest.fn();
    const widths: Record<string, number> = { 毎朝: 100, コーヒーを: 200, 飲みます: 200, 私は: 60 };
    const width = (el: Element) => widths[el.textContent ?? ''] ?? 0;
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      let left = 0;
      for (let el = this.previousElementSibling; el; el = el.previousElementSibling) {
        left += width(el);
      }
      return { left, width: width(this) } as DOMRect;
    });
    document.elementFromPoint = (x: number) =>
      screen.getAllByRole('button').find((b) => {
        const { left } = b.getBoundingClientRect();
        return x >= left && x < left + width(b);
      }) ?? null;
    const dragged = chunk('私は');
    const moveTo = (clientX: number, times = 1) => {
      for (let i = 0; i < times; i++) fireEvent.pointerMove(dragged, { pointerId: 1, clientX });
    };

    // Only the primary button starts a drag.
    fireEvent.pointerDown(dragged, { pointerId: 1, button: 2 });
    expect(dragged.getAttribute('data-dragging')).toBe('false');
    fireEvent.pointerDown(dragged, { pointerId: 1, button: 0 });
    expect(dragged.getAttribute('data-dragging')).toBe('true');

    // 飲みます spans 300 to 500: nothing moves until the pointer passes its middle.
    moveTo(450);
    expect(chunks()).toEqual(['毎朝', 'コーヒーを', '飲みます', '私は']);
    moveTo(350);
    expect(chunks()).toEqual(['毎朝', 'コーヒーを', '私は', '飲みます']);
    // コーヒーを (100 to 300) stays under the pointer over several moves short of its middle.
    moveTo(250, 3);
    expect(chunks()).toEqual(['毎朝', 'コーヒーを', '私は', '飲みます']);
    moveTo(150);
    expect(chunks()).toEqual(['毎朝', '私は', 'コーヒーを', '飲みます']);
    // Back over the wide コーヒーを, now 160 to 360: it does not flip back and forth.
    moveTo(200, 3);
    expect(chunks()).toEqual(['毎朝', '私は', 'コーヒーを', '飲みます']);
    moveTo(40);
    fireEvent.pointerUp(dragged, { pointerId: 1 });
    expect(chunks()).toEqual(['私は', '毎朝', 'コーヒーを', '飲みます']);
    expect(dragged.getAttribute('data-dragging')).toBe('false');
    expect(onAnswer).toHaveBeenLastCalledWith([0, 1, 2, 3]);
    expect(grade()).toBe('correct');

    // Moving without a drag in progress changes nothing, and a lost capture ends a drag.
    moveTo(450);
    expect(chunks()).toEqual(['私は', '毎朝', 'コーヒーを', '飲みます']);
    fireEvent.pointerDown(dragged, { pointerId: 1, button: 0 });
    expect(dragged.getAttribute('data-dragging')).toBe('true');
    fireEvent.lostPointerCapture(dragged, { pointerId: 1 });
    expect(dragged.getAttribute('data-dragging')).toBe('false');
  });
});

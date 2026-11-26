import { Suspense } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FILL_BLANK_TYPE, gradeResponse, TYPED_ANSWER_TYPE } from '@manabi/core';
import type { Exercise, Tile } from '@manabi/core';
import { japanese as plugin } from '@manabi/lang-ja';
import '../../i18n';
import { AppThemeProvider } from '../../theme';
import './renderers';
import { WordBankAlternative } from './WordBankAlternative';
import { answerFromTiles, toWordBankPayload } from './wordBankAlternative';

// FR-144: the word-bank alternative to typed exercises below 768 px.

const tile = (surface: string): Tile => ({ surface, base: surface, reading: surface });
const typed = (tiles: Tile[], text = 'わたしはがくせいです'): Exercise => ({
  type: TYPED_ANSWER_TYPE,
  payload: { prompt: 'I am a student', answerLanguage: 'target', accept: [{ text, tiles }] },
});
const stored = [tile('わたし'), tile('は'), tile('がくせい'), tile('です')];

describe('toWordBankPayload', () => {
  it('uses the stored tiles as they are', () => {
    const exercise = typed([tile('わたしは'), tile('がくせいです')]);
    const bank = toWordBankPayload(exercise.type, exercise.payload, plugin)!;
    expect(bank.answer.tiles).toEqual([tile('わたしは'), tile('がくせいです')]);
    expect(bank.acceptedOrders).toEqual([[0, 1]]);
  });

  it('falls back to script runs only when no tiles are stored', () => {
    const exercise = typed([], 'ひらカタ');
    const bank = toWordBankPayload(exercise.type, exercise.payload, plugin)!;
    expect(bank.answer.tiles.map((t) => t.surface)).toEqual(['ひら', 'カタ']);
  });

  it('puts the sentence around a fill-blank blank in the prompt, and skips one with options', () => {
    const accept = [{ text: 'は', tiles: [tile('は')] }];
    const payload = { prompt: 'I', before: 'わたし', after: 'がくせい', accept };
    expect(toWordBankPayload(FILL_BLANK_TYPE, payload, plugin)!.prompt).toBe(
      'I わたし＿＿がくせい',
    );
    expect(
      toWordBankPayload(FILL_BLANK_TYPE, { ...payload, options: ['は', 'を'] }, plugin),
    ).toBeNull();
  });

  it('has no tile form for other exercise types', () => {
    expect(toWordBankPayload('choice', {}, plugin)).toBeNull();
  });

  it('turns tiles into an answer the typed grader accepts only in the right order', () => {
    const exercise = typed(stored);
    const bank = toWordBankPayload(exercise.type, exercise.payload, plugin)!;
    const grade = (order: number[]) =>
      gradeResponse(exercise, { attempts: [answerFromTiles(bank, order)] }, plugin).result;
    expect(grade([0, 1, 2, 3])).toBe('correct');
    expect(grade([1, 0, 2, 3])).toBe('wrong');
  });
});

function setup(width: number, preferred = false, exercise = typed(stored)) {
  window.matchMedia = ((query: string) => ({
    matches: query === '(min-width: 768px)' && width >= 768,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  const onAnswer = jest.fn();
  render(
    <AppThemeProvider>
      <Suspense fallback={null}>
        <WordBankAlternative
          type={exercise.type}
          payload={exercise.payload}
          plugin={plugin}
          preferred={preferred}
          onAnswer={onAnswer}
        >
          <input aria-label="typed" />
        </WordBankAlternative>
      </Suspense>
    </AppThemeProvider>,
  );
  return onAnswer;
}

describe('WordBankAlternative', () => {
  it('shows the toggle below 768 px only', () => {
    setup(767);
    expect(screen.getByRole('button', { name: 'Use word bank instead' })).toBeTruthy();
  });

  it('shows no toggle at 768 px and above', () => {
    setup(768, true);
    expect(screen.queryByRole('button', { name: 'Use word bank instead' })).toBeNull();
    expect(screen.getByLabelText('typed')).toBeTruthy();
  });

  it('starts typed by default and switches to tiles and back', async () => {
    const onAnswer = setup(375);
    expect(screen.getByLabelText('typed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use word bank instead' }));
    expect(await screen.findByRole('group', { name: 'Word bank' })).toBeTruthy();
    expect(onAnswer).toHaveBeenLastCalledWith('');
    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    expect(screen.getByLabelText('typed')).toBeTruthy();
  });

  it('starts as a word bank when the setting is on, and reports the typed answer', async () => {
    const onAnswer = setup(375, true);
    const bank = await screen.findByRole('group', { name: 'Word bank' });
    expect(screen.queryByLabelText('typed')).toBeNull();
    for (const surface of ['わたし', 'は', 'がくせい', 'です']) {
      fireEvent.click(
        Array.from(bank.querySelectorAll('button')).find((b) => b.textContent === surface)!,
      );
    }
    expect(onAnswer).toHaveBeenLastCalledWith('わたしはがくせいです');
  });
});

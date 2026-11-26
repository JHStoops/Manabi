import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import HanziWriter from 'hanzi-writer';
import type { ApiClient } from '@manabi/api-client';
import { DRAW_MEMORY_TYPE, STROKE_TRACE_TYPE } from '@manabi/core';
import { japanese as plugin } from '@manabi/lang-ja';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { ExerciseRendererHarness } from '../exercises/ExerciseRendererHarness';
import '../exercises/renderers';
import { StrokeCanvas } from './StrokeCanvas';

// FR-071 (play, step, replay) and FR-072, FR-073 (trace mode judges each stroke and discards a
// wrong one), with Hanzi Writer itself rendering into jsdom.

// Two horizontal strokes drawn left to right, in Hanzi Writer's 1024-unit y-up space.
const TWO = {
  strokes: [
    'M 150 580 L 850 580 L 850 620 L 150 620 Z',
    'M 100 180 L 900 180 L 900 220 L 100 220 Z',
  ],
  medians: [
    [
      [150, 600],
      [500, 600],
      [850, 600],
    ],
    [
      [100, 200],
      [500, 200],
      [900, 200],
    ],
  ] as Array<Array<[number, number]>>,
};

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => jest.restoreAllMocks());

function fakeApi() {
  const get = jest.fn(async () => TWO);
  return { get, api: { GET: get } as unknown as ApiClient };
}

describe('StrokeCanvas animation', () => {
  it('loads the strokes by item key and plays, pauses, steps and replays', async () => {
    // Stubbed, so no animation outlives the test.
    const animateCharacter = jest
      .spyOn(HanziWriter.prototype, 'animateCharacter')
      .mockResolvedValue(undefined);
    const pauseAnimation = jest
      .spyOn(HanziWriter.prototype, 'pauseAnimation')
      .mockResolvedValue(undefined);
    const resumeAnimation = jest
      .spyOn(HanziWriter.prototype, 'resumeAnimation')
      .mockResolvedValue(undefined);
    const animateStroke = jest
      .spyOn(HanziWriter.prototype, 'animateStroke')
      .mockResolvedValue(undefined);
    const { get, api } = fakeApi();
    render(
      <ApiContext.Provider value={api}>
        <AppThemeProvider>
          <StrokeCanvas itemKey="ja:kanji:二" character="二" mode="animate" />
        </AppThemeProvider>
      </ApiContext.Provider>,
    );
    expect(screen.getByRole('img', { name: 'Stroke order of 二' })).toBeTruthy();
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/api/v1/media/strokes/{itemKey}', {
        params: { path: { itemKey: 'ja:kanji:二' } },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(animateCharacter).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(pauseAnimation).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(resumeAnimation).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Next stroke' }));
    expect(animateStroke).toHaveBeenLastCalledWith(0);
    expect(screen.getByRole('status').textContent).toBe('Stroke 1 of 2');
    fireEvent.click(screen.getByRole('button', { name: 'Next stroke' }));
    expect(animateStroke).toHaveBeenLastCalledWith(1);
    // After the last stroke, stepping starts over.
    fireEvent.click(screen.getByRole('button', { name: 'Next stroke' }));
    expect(animateStroke).toHaveBeenLastCalledWith(0);

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(animateCharacter).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });
});

describe('stroke drawing renderers', () => {
  // Hanzi Writer maps its 1024 box into the 300 px board less 16 px padding, with y pointing up;
  // jsdom puts the board at (0, 0).
  const scale = (300 - 32) / 1024;
  const toScreen = ([x, y]: [number, number]) => ({
    clientX: 16 + x * scale,
    clientY: 16 + (900 - y) * scale,
  });

  /** Drags the mouse through `points` (in Hanzi Writer space) on the drawing surface. */
  function draw(points: Array<[number, number]>) {
    const svg = document.querySelector('svg')!;
    act(() => {
      fireEvent.mouseDown(svg, toScreen(points[0]!));
      for (const p of points.slice(1)) fireEvent.mouseMove(svg, toScreen(p));
      fireEvent.mouseUp(document);
    });
  }

  /** `count` evenly spaced points along a horizontal line. */
  const line = (x0: number, x1: number, y: number, count = 12) =>
    Array.from(
      { length: count },
      (_, i) => [x0 + ((x1 - x0) * i) / (count - 1), y] as [number, number],
    );

  it('shakes off and discards a reversed stroke, then reports the finished trace', async () => {
    const { get, api } = fakeApi();
    const onAnswer = jest.fn();
    render(
      <ApiContext.Provider value={api}>
        <ExerciseRendererHarness
          exercise={{
            type: STROKE_TRACE_TYPE,
            payload: { itemKey: 'ja:kanji:二', character: '二' },
          }}
          plugin={plugin}
          onAnswer={onAnswer}
        />
      </ApiContext.Provider>,
    );
    expect(await screen.findByText('Trace 二, one stroke at a time')).toBeTruthy();
    const board = screen.getByRole('img', { name: 'Drawing area for 二' });
    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(document.querySelector('svg path')).toBeTruthy());

    // Stroke 1 drawn right to left: wrong direction.
    draw(line(850, 150, 600));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Not that stroke. Try again.'),
    );
    expect(board.getAttribute('data-shake')).toBe('true');
    // Stroke 2 drawn first: wrong order.
    draw(line(100, 900, 200));
    expect(onAnswer).not.toHaveBeenCalled();

    draw(line(150, 850, 600));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Stroke 1 of 2'));
    draw(line(100, 900, 200));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith({ mistakes: 2 }));
    expect(screen.getByRole('status').textContent).toBe('All strokes done');
  });

  it('EX-12 hides the guide, flashes a stroke once after its second miss, then passes', async () => {
    const highlight = jest.spyOn(HanziWriter.prototype, 'highlightStroke');
    const { api } = fakeApi();
    const onAnswer = jest.fn();
    render(
      <ApiContext.Provider value={api}>
        <ExerciseRendererHarness
          exercise={{
            type: DRAW_MEMORY_TYPE,
            payload: { itemKey: 'ja:kanji:二', character: '二', prompt: 'Draw "two"' },
          }}
          plugin={plugin}
          onAnswer={onAnswer}
        />
      </ApiContext.Provider>,
    );
    expect(await screen.findByText('Draw "two"')).toBeTruthy();
    // The accessible name must not give the character away.
    expect(screen.getByRole('img', { name: 'Drawing area' })).toBeTruthy();
    await waitFor(() => expect(document.querySelector('svg path')).toBeTruthy());

    // Stroke 1 reversed three times: the guide flashes at the second miss only.
    draw(line(850, 150, 600));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Not that stroke. Try again.'),
    );
    expect(highlight).not.toHaveBeenCalled();
    draw(line(850, 150, 600));
    await waitFor(() => expect(highlight).toHaveBeenCalledWith(0));
    draw(line(850, 150, 600));
    expect(highlight).toHaveBeenCalledTimes(1);

    draw(line(150, 850, 600));
    // No stroke count either: it is part of what is tested.
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(''));
    draw(line(100, 900, 200));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith({ mistakes: 3 }));
    expect(highlight).toHaveBeenCalledTimes(1);
  });
});

import { useEffect, useRef, useState } from 'react';
import { keyframes, useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import HanziWriter from 'hanzi-writer';
import { STROKE_LENIENCY } from '@manabi/core';
import { useApi } from '../../state/session';
import { ChoiceButton } from '../exercises/ui';

// The stroke canvas (SDD section 9; Product Spec section 5): Hanzi Writer (MIT, bundled) fed our
// KanjiVG-derived data from GET /media/strokes/:itemKey, never its CDN or bundled data (FR-077).
// `animate` plays the stroke order (FR-071); `trace` judges drawn strokes with Hanzi Writer's
// matcher, flashing the next stroke as a guide and shaking off wrong ones (FR-072, FR-073);
// `memory` judges the same way with no outline or guide, flashing a stroke once after 2 misses.
// Hanzi Writer listens to mouse and touch events; a stylus arrives as touch (IF-11).

const SIZE = 300;

const shake = keyframes`
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
`;

// A faint square grid: the frame plus a centre cross, like practice paper.
const Board = styled.div`
  width: ${SIZE}px;
  height: ${SIZE}px;
  margin: 0 auto;
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.small};
  background:
    linear-gradient(${({ theme }) => theme.colors.border}, ${({ theme }) => theme.colors.border})
      center / 1px 100% no-repeat,
    linear-gradient(${({ theme }) => theme.colors.border}, ${({ theme }) => theme.colors.border})
      center / 100% 1px no-repeat,
    ${({ theme }) => theme.colors.surface};
  /* Drawing must not scroll or zoom the page. */
  touch-action: none;
  &[data-shake='true'] {
    animation: ${shake} 300ms;
  }
  @media (prefers-reduced-motion: reduce) {
    &[data-shake='true'] {
      animation: none;
    }
  }
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(3)};
`;

const Status = styled.p`
  margin: ${({ theme }) => theme.spacing(2)} 0 0;
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export interface StrokeCanvasProps {
  itemKey: string;
  character: string;
  mode: 'animate' | 'trace' | 'memory';
  /** Trace and memory modes: called once every stroke is drawn, with the number of discarded strokes. */
  onComplete?(mistakes: number): void;
}

export function StrokeCanvas({ itemKey, character, mode, onComplete }: StrokeCanvasProps) {
  const { t } = useTranslation();
  const api = useApi();
  const theme = useTheme();
  const board = useRef<HTMLDivElement>(null);
  const writer = useRef<HanziWriter | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [strokeCount, setStrokeCount] = useState(0);
  const [stroke, setStroke] = useState(0);
  const [status, setStatus] = useState('');
  const [shaking, setShaking] = useState(false);
  const [playing, setPlaying] = useState(false);
  const paused = useRef(false);

  useEffect(() => {
    const node = board.current!;
    const created = HanziWriter.create(node, character, {
      width: SIZE,
      height: SIZE,
      padding: 16,
      showCharacter: mode === 'animate',
      showOutline: mode !== 'memory',
      strokeColor: theme.colors.text,
      outlineColor: theme.colors.border,
      highlightColor: theme.colors.primary,
      drawingColor: theme.colors.primary,
      radicalColor: null,
      charDataLoader: (_char, onLoad, onError) => {
        api
          .GET('/api/v1/media/strokes/{itemKey}', { params: { path: { itemKey } } })
          .then((data) => {
            setStrokeCount(data.strokes.length);
            onLoad(data);
          }, onError);
      },
      onLoadCharDataError: () => setStatus(t('strokes.loadFailed')),
    });
    writer.current = created;
    if (mode !== 'animate') {
      const trace = mode === 'trace';
      void created.quiz({
        leniency: STROKE_LENIENCY,
        // Trace: a miss flashes the stroke again; the guide also flashes before each stroke
        // (below). Memory: the stroke flashes once, at its second miss (FR-073).
        showHintAfterMisses: trace ? 1 : false,
        onMistake: ({ strokeNum, mistakesOnStroke }) => {
          setShaking(true);
          setStatus(t('strokes.mistake'));
          if (!trace && mistakesOnStroke === 2) void created.highlightStroke(strokeNum);
        },
        onCorrectStroke: ({ strokeNum, strokesRemaining }) => {
          setStroke(strokeNum + 1);
          setStatus('');
          if (trace && strokesRemaining > 0) void created.highlightStroke(strokeNum + 1);
        },
        onComplete: ({ totalMistakes }) => {
          setStatus(t('strokes.done'));
          onCompleteRef.current?.(totalMistakes);
        },
      });
      if (trace) void created.highlightStroke(0);
    }
    return () => {
      created.cancelQuiz();
      node.replaceChildren();
      writer.current = null;
    };
  }, [api, character, itemKey, mode, t, theme]);

  const finished = () => {
    paused.current = false;
    setPlaying(false);
  };
  const play = () => {
    if (paused.current) void writer.current?.resumeAnimation();
    else void writer.current?.animateCharacter({ onComplete: finished });
    paused.current = false;
    setPlaying(true);
    setStroke(0);
  };
  const pause = () => {
    void writer.current?.pauseAnimation();
    paused.current = true;
    setPlaying(false);
  };
  const replay = () => {
    paused.current = false;
    setPlaying(true);
    setStroke(0);
    void writer.current?.animateCharacter({ onComplete: finished });
  };
  const step = () => {
    const w = writer.current;
    if (!w || strokeCount === 0) return;
    finished();
    const next = stroke % strokeCount;
    if (next === 0) void w.hideCharacter();
    void w.animateStroke(next);
    setStroke(next + 1);
  };

  return (
    <div>
      <Board
        ref={board}
        role="img"
        aria-label={t(
          (
            {
              animate: 'strokes.animation',
              trace: 'strokes.canvas',
              memory: 'strokes.memoryCanvas',
            } as const
          )[mode],
          { character },
        )}
        data-shake={shaking}
        onAnimationEnd={() => setShaking(false)}
      />
      {mode === 'animate' && (
        <Controls>
          <ChoiceButton type="button" onClick={playing ? pause : play}>
            {t(playing ? 'strokes.pause' : 'strokes.play')}
          </ChoiceButton>
          <ChoiceButton type="button" onClick={step}>
            {t('strokes.step')}
          </ChoiceButton>
          <ChoiceButton type="button" onClick={replay}>
            {t('strokes.replay')}
          </ChoiceButton>
        </Controls>
      )}
      <Status role="status">
        {status ||
          // Memory mode keeps the stroke count to itself: it is part of what is tested.
          (mode !== 'memory' && strokeCount > 0 && stroke > 0
            ? t('strokes.progress', { stroke, count: strokeCount })
            : '')}
      </Status>
    </div>
  );
}

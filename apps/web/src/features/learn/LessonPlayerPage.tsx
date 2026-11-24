import { Suspense, useCallback, useEffect, useReducer, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import styled from '@emotion/styled';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { gradeResponse } from '@manabi/core';
import type { ExerciseResponse, Item } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import { useApi } from '../../state/session';
import { tapTarget } from '../../theme';
import { apiErrorMessage } from '../auth/ui';
import { getExerciseRenderer } from '../exercises/registry';
import { LessonResults } from './LessonResults';
import { initialPlayerState, lessonPlayerReducer } from './lessonPlayer';

// shortcut: grades with the only shipped plugin (ja); look up the course's plugin when a second
// language plugin lands (the session response would then need to name it).
const plugin = japanese;

// NFR-31: every feedback color comes with an icon (and text).
const icons = { close: '✕', correct: '✓', tryAgain: '!', wrong: '✗' };

// Product Spec section 2: full screen at all sizes, outside the tab layout.
const Screen = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-width: 640px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing(4)};
  box-sizing: border-box;
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  font-family: system-ui, sans-serif;
`;

const Top = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-bottom: ${({ theme }) => theme.spacing(6)};
  progress {
    flex: 1;
    height: 16px;
    accent-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Close = styled(Link)`
  ${({ theme }) => tapTarget(theme)};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.title};
  text-decoration: none;
`;

const Body = styled.main`
  flex: 1;
  &:focus {
    outline: none;
  }
`;

const Bar = styled.div<{ tone: Exclude<keyof typeof icons, 'close'> | null }>`
  min-height: 1.5em;
  margin: ${({ theme }) => theme.spacing(4)} 0;
  padding: ${({ tone, theme }) => (tone ? theme.spacing(3) : 0)};
  border-left: ${({ tone, theme }) => (tone ? `6px solid ${theme.colors[tone]}` : 'none')};
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ tone, theme }) => (tone ? theme.colors.surface : 'transparent')};
  font-weight: bold;
  [aria-hidden] {
    margin-right: ${({ theme }) => theme.spacing(2)};
    color: ${({ tone, theme }) => (tone ? theme.colors[tone] : 'inherit')};
  }
`;

const Action = styled.button`
  ${({ theme }) => tapTarget(theme)};
  width: 100%;
  padding: ${({ theme }) => theme.spacing(3)};
  border: none;
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primaryText};
  font-size: ${({ theme }) => theme.fontSizes.body};
  font-weight: bold;
  text-align: center;
  text-decoration: none;
  box-sizing: border-box;
  display: block;
  cursor: pointer;
  &[aria-disabled='true'] {
    cursor: default;
    opacity: 0.5;
  }
`;

const DoneLink = Action.withComponent(Link);

const Card = styled.dl`
  padding: ${({ theme }) => theme.spacing(4)};
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.surface};
  dt {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.small};
  }
  dd {
    margin: 0 0 ${({ theme }) => theme.spacing(2)};
    font-size: ${({ theme }) => theme.fontSizes.title};
  }
`;

// shortcut: lists the item's plain data fields; a designed card per item type (reading, meaning,
// audio, one example: Product Spec section 4) needs a display member on the language plugin.
function TeachingCard({ item }: { item: Item }) {
  const fields = Object.entries(item.data).flatMap(([key, value]) =>
    typeof value === 'string' || typeof value === 'number'
      ? [[key, String(value)]]
      : Array.isArray(value) && value.every((v) => typeof v === 'string')
        ? [[key, value.join(', ')]]
        : [],
  );
  return (
    <Card>
      {fields.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </Card>
  );
}

/** FR-046, FR-047, FR-168, Product Spec section 4: the full-screen lesson player. */
export default function LessonPlayerPage() {
  const { t } = useTranslation();
  const api = useApi();
  const { lessonId = '' } = useParams();
  const [state, dispatch] = useReducer(lessonPlayerReducer, initialPlayerState);
  const { phase, session, error } = state;
  const bodyRef = useRef<HTMLElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  // FR-050: starting again within 24 hours resumes the same server session; leaving keeps it.
  useEffect(() => {
    let current = true;
    api
      .POST('/api/v1/lessons/{id}/sessions', { params: { path: { id: lessonId } }, body: {} })
      .then(
        (loaded) => current && dispatch({ type: 'loaded', session: loaded }),
        (err: unknown) => current && dispatch({ type: 'failed', error: err }),
      );
    return () => {
      current = false;
    };
  }, [api, lessonId]);

  // FR-052: one key per session, so a retried or repeated completion is applied once.
  const { responses } = state;
  useEffect(() => {
    if (phase !== 'completing' || error || !session) return;
    let current = true;
    api
      .POST('/api/v1/lesson-sessions/{id}/complete', {
        params: { path: { id: String(session.id) } },
        body: { responses: responses.filter((r): r is ExerciseResponse => r !== undefined) },
        idempotencyKey: `lesson-session-${session.id}`,
      })
      .then(
        (completion) => current && dispatch({ type: 'completed', completion }),
        (err: unknown) => current && dispatch({ type: 'failed', error: err }),
      );
    return () => {
      current = false;
    };
  }, [api, phase, error, session, responses]);

  const exerciseIndex = state.queue[0];
  const exercise = exerciseIndex === undefined ? undefined : session?.exercises[exerciseIndex];
  const onAnswer = useCallback((answer: unknown) => dispatch({ type: 'answered', answer }), []);

  // Focus management: a new screen focuses its content, feedback focuses Continue.
  useEffect(() => {
    if (phase === 'feedback') actionRef.current?.focus();
    else bodyRef.current?.focus();
  }, [phase, state.step, state.card]);

  function act() {
    if (phase !== 'answering') return dispatch({ type: 'next' });
    if (state.answer === undefined || !exercise) return;
    // NFR-03: graded here with the shared grader, no network round-trip.
    try {
      dispatch({
        type: 'checked',
        grade: gradeResponse(exercise, { attempts: [state.answer] }, plugin),
      });
    } catch (err) {
      // A malformed payload or answer: say so rather than fail silently.
      dispatch({ type: 'failed', error: err });
    }
  }

  // SDD section 9: Enter checks or continues. Other buttons and links keep their own Enter.
  function onKeyDown(event: ReactKeyboardEvent) {
    const target = event.target as Element;
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    if (target.closest('button, a, select, textarea') && target !== actionRef.current) return;
    event.preventDefault();
    act();
  }

  const { grade } = state;
  let tone: Exclude<keyof typeof icons, 'close'> | null = null;
  let message = '';
  if (phase === 'answering' && grade) {
    tone = 'tryAgain';
    message = t('player.tryAgain');
  } else if (phase === 'feedback' && grade?.result === 'wrong') {
    tone = 'wrong';
    message = grade.feedback
      ? t('player.wrong', { answer: grade.feedback })
      : t('player.wrongNoAnswer');
  } else if (phase === 'feedback' && grade) {
    tone = 'correct';
    message =
      grade.result === 'near-miss' ? `${t('player.correct')} ${grade.hint}` : t('player.correct');
  }

  let content;
  let actionLabel = t('player.next');
  if (error && phase !== 'completing' && phase !== 'answering') {
    content = <p role="alert">{apiErrorMessage(t, error)}</p>;
  } else if (phase === 'loading') {
    content = <p>{t('app.loading')}</p>;
  } else if (phase === 'intro') {
    content = (
      <>
        <h1>{t('area.lesson')}</h1>
        <p>{t('player.intro', { count: session!.teachingCards.length })}</p>
      </>
    );
    actionLabel = t('player.start');
  } else if (phase === 'teaching') {
    const cards = session!.teachingCards;
    content = (
      <>
        <h1>{t('player.newItem', { n: state.card + 1, total: cards.length })}</h1>
        <TeachingCard item={cards[state.card]!.item} />
      </>
    );
  } else if (exercise && (phase === 'answering' || phase === 'feedback')) {
    const Renderer = getExerciseRenderer(exercise.type);
    content = (
      <Suspense fallback={<p>{t('app.loading')}</p>}>
        {phase === 'answering' && !!error && <p role="alert">{t('player.gradeFailed')}</p>}
        <Renderer key={state.step} payload={exercise.payload} plugin={plugin} onAnswer={onAnswer} />
      </Suspense>
    );
    actionLabel = phase === 'feedback' ? t('player.continue') : t('player.check');
  } else if (phase === 'completing') {
    content = error ? <p role="alert">{apiErrorMessage(t, error)}</p> : <p>{t('player.saving')}</p>;
    actionLabel = t('player.retry');
  } else if (phase === 'results' && state.completion) {
    content = (
      <>
        <h1>{t('area.lesson')}</h1>
        <p>{t('player.accuracy', { accuracy: state.completion.accuracy })}</p>
        <LessonResults xpEarned={state.completion.xpEarned} totalXp={state.completion.totalXp} />
      </>
    );
  }

  const total = session?.exercises.length ?? 0;
  const showAction =
    ['intro', 'teaching', 'answering', 'feedback'].includes(phase) ||
    (phase === 'completing' && !!error);
  const actionDisabled = phase === 'answering' && state.answer === undefined;

  return (
    <Screen onKeyDown={onKeyDown}>
      <Top>
        <Close to="/learn" aria-label={t('player.close')}>
          <span aria-hidden="true">{icons.close}</span>
        </Close>
        {session && (
          <progress
            aria-label={t('player.progress')}
            value={total - state.queue.length}
            max={total}
          />
        )}
      </Top>
      <Body
        ref={bodyRef}
        tabIndex={-1}
        aria-label={
          phase === 'answering' || phase === 'feedback' ? t('player.exercise') : undefined
        }
      >
        {content}
      </Body>
      {/* IF-03 / SDD section 9: one live region for feedback; NFR-31: icon and text with color. */}
      <Bar tone={tone} role="status" aria-live="polite">
        {tone && <span aria-hidden="true">{icons[tone]}</span>}
        {message}
      </Bar>
      {showAction && (
        <Action
          ref={actionRef}
          type="button"
          aria-disabled={actionDisabled}
          onClick={() => !actionDisabled && act()}
        >
          {actionLabel}
        </Action>
      )}
      {phase === 'results' && <DoneLink to="/learn">{t('player.done')}</DoneLink>}
    </Screen>
  );
}

import type { Dispatch } from 'react';
import { Suspense, useCallback, useEffect, useReducer, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import styled from '@emotion/styled';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UnknownLanguagePluginError,
  createLanguagePluginRegistry,
  gradeResponse,
} from '@manabi/core';
import type {
  AnswerText,
  ExerciseResponse,
  LanguagePlugin,
  TeachingCard as TeachingCardData,
  Tile,
} from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import { SpeakerButton } from '../audio/SpeakerButton';
import { SpeechProvider, useSpeech } from '../audio/speech';
import { useApi } from '../../state/session';
import { tapTarget } from '../../theme';
import { apiErrorMessage } from '../auth/ui';
import { getExerciseRenderer } from '../exercises/registry';
import { LessonResults } from './LessonResults';
import { initialPlayerState, lessonPlayerReducer } from './lessonPlayer';
import type { PlayerAction } from './lessonPlayer';

/** The language plugins the web app ships; a session names its course's plugin (FR-242). */
const plugins = createLanguagePluginRegistry([japanese]);

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

const Card = styled.div`
  padding: ${({ theme }) => theme.spacing(4)};
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.surface};
  dl {
    margin: 0;
  }
  dt {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.small};
  }
  dd {
    margin: 0 0 ${({ theme }) => theme.spacing(2)};
    font-size: ${({ theme }) => theme.fontSizes.title};
  }
`;

const Term = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing(4)};
  font-size: 4rem;
  text-align: center;
`;

/** Product Spec section 4: one new item, as the course's plugin shows it (FR-141). */
function TeachingCard(props: {
  card: TeachingCardData;
  plugin: LanguagePlugin;
  sectionLevel: string;
}) {
  const { t } = useTranslation();
  const { term, reading, meaning, spoken } = props.plugin.teachingCard(
    props.card.item,
    props.sectionLevel,
  );
  const { example } = props.card;
  return (
    <Card>
      {/* The session has no targetLang; the plugin code is the language code (ja). */}
      <Term lang={props.plugin.code}>{term}</Term>
      <dl>
        {reading && (
          <div>
            <dt>{t('player.reading')}</dt>
            <dd lang={props.plugin.code}>{reading}</dd>
          </div>
        )}
        {meaning && (
          <div>
            <dt>{t('player.meaning')}</dt>
            <dd>{meaning}</dd>
          </div>
        )}
        {example && (
          <div>
            <dt>{t('player.example')}</dt>
            <dd lang={props.plugin.code}>{example.text}</dd>
            <dd>{example.translation}</dd>
          </div>
        )}
      </dl>
      <SpeakerButton reading={spoken} />
      <SpeakerButton reading={spoken} slow />
      {example && <SpeakerButton reading={props.plugin.readingOf(example.tiles)} />}
    </Card>
  );
}

/** FR-135: tells the player whether the device can speak, so it drops listening exercises. */
function SkipListening({ dispatch }: { dispatch: Dispatch<PlayerAction> }) {
  const { canSpeak } = useSpeech();
  useEffect(() => dispatch({ type: 'canSpeak', canSpeak }), [dispatch, canSpeak]);
  return null;
}

/** DR-12: the tiles of an exercise's answer text, when its payload has any (typed, word bank). */
function answerTiles(payload: unknown): Tile[] {
  const { answer, accept } = payload as { answer?: AnswerText; accept?: AnswerText[] };
  return (answer ?? accept?.[0])?.tiles ?? [];
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
        (loaded) =>
          current &&
          dispatch(
            plugins.has(loaded.plugin)
              ? { type: 'loaded', session: loaded }
              : { type: 'failed', error: new UnknownLanguagePluginError(loaded.plugin) },
          ),
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

  const plugin = session && plugins.get(session.plugin);
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
    if (state.answer === undefined || !exercise || !plugin) return;
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
    content = (
      <p role="alert">
        {error instanceof UnknownLanguagePluginError
          ? t('player.unknownLanguage')
          : apiErrorMessage(t, error)}
      </p>
    );
  } else if (phase === 'loading') {
    content = <p>{t('app.loading')}</p>;
  } else if (phase === 'intro' && session && plugin) {
    // Product Spec section 4: the lesson's title, type and the items it will teach.
    content = (
      <>
        <h1>{session.lessonTitle}</h1>
        <p>{t(`learn.lessonType.${session.lessonType}`)}</p>
        <p>{t('player.intro', { count: session.teachingCards.length })}</p>
        <ul lang={plugin.code}>
          {session.teachingCards.map(({ item }) => (
            <li key={item.id}>{plugin.teachingCard(item, session.sectionLevel).term}</li>
          ))}
        </ul>
      </>
    );
    actionLabel = t('player.start');
  } else if (phase === 'teaching' && session && plugin) {
    const cards = session.teachingCards;
    content = (
      <>
        <h1>{t('player.newItem', { n: state.card + 1, total: cards.length })}</h1>
        <TeachingCard
          card={cards[state.card]!}
          plugin={plugin}
          sectionLevel={session.sectionLevel}
        />
      </>
    );
  } else if (exercise && plugin && (phase === 'answering' || phase === 'feedback')) {
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

  // FR-135: hear the answer after feedback; choice exercises have no tiles, so no button yet.
  const answerReading =
    phase === 'feedback' && exercise && plugin
      ? plugin.readingOf(answerTiles(exercise.payload))
      : '';

  return (
    <SpeechProvider locale={plugin?.ttsVoice.locale ?? ''}>
      <Screen onKeyDown={onKeyDown}>
        {session && <SkipListening dispatch={dispatch} />}
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
        {answerReading && (
          <div>
            <SpeakerButton reading={answerReading} />
            <SpeakerButton reading={answerReading} slow />
          </div>
        )}
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
    </SpeechProvider>
  );
}

import type { Dispatch } from 'react';
import { Suspense, lazy, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import styled from '@emotion/styled';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  TEST_OUT_PASS_ACCURACY,
  UnknownLanguagePluginError,
  acceptsAnswerReports,
  gradeResponse,
  payloadItemIds,
} from '@manabi/core';
import type {
  AnswerText,
  ExerciseResponse,
  LanguagePlugin,
  ReviewExercise,
  ReviewSession,
  TeachingCard as TeachingCardData,
  Tile,
} from '@manabi/core';
import { SpeakerButton } from '../audio/SpeakerButton';
import { SpeechProvider, useSpeech } from '../audio/speech';
import { plugins } from '../../state/plugins';
import { useApi, useSession } from '../../state/session';
import { Confetti, tapTarget, useSound } from '../../theme';
import { apiErrorMessage } from '../auth/ui';
import { getExerciseRenderer } from '../exercises/registry';
import { WordBankAlternative } from '../exercises/WordBankAlternative';
import { LessonResults } from './LessonResults';
import { ReportAnswerButton } from './ReportAnswerButton';

import { initialPlayerState, lessonPlayerReducer } from './lessonPlayer';
import type { PlayerAction, PlayerCompletion, PlayerSession } from './lessonPlayer';

// FR-071: Hanzi Writer loads only when a teaching card animates strokes (NFR-04 first load).
const StrokeCanvas = lazy(() =>
  import('../strokes/StrokeCanvas').then((m) => ({ default: m.StrokeCanvas })),
);

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
  caption {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.small};
    text-align: start;
  }
  table {
    margin-bottom: ${({ theme }) => theme.spacing(2)};
    border-collapse: collapse;
  }
  th,
  td {
    padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(3)}
      ${({ theme }) => theme.spacing(1)} 0;
    text-align: start;
  }
`;

const Speakers = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(3)};
`;

const Term = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing(4)};
  font-size: 4rem;
  text-align: center;
`;

/** Product Spec section 5: a kanji's words, each as term, reading and meaning on one line. */
const WordList = styled.ul`
  padding: 0;
  list-style: none;
  li {
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing(2)};
  }
`;

/** Product Spec sections 4 and 6: one new item, as the course's plugin shows it (FR-141). */
function TeachingCard(props: {
  card: TeachingCardData;
  plugin: LanguagePlugin;
  sectionLevel: string;
}) {
  const { t } = useTranslation();
  const { term, reading, meaning, spoken, formation } = props.plugin.teachingCard(
    props.card.item,
    props.sectionLevel,
  );
  const lang = props.plugin.code;
  return (
    <Card>
      {/* The session has no targetLang; the plugin code is the language code (ja). */}
      <Term lang={lang}>{term}</Term>
      {props.card.strokeAnimation && (
        <Suspense fallback={null}>
          <StrokeCanvas itemKey={props.card.item.key} character={term} mode="animate" />
        </Suspense>
      )}
      <dl>
        {reading && (
          <div>
            <dt>{t('player.reading')}</dt>
            <dd lang={lang}>{reading}</dd>
          </div>
        )}
        {meaning && (
          <div>
            <dt>{t('player.meaning')}</dt>
            <dd>{meaning}</dd>
          </div>
        )}
      </dl>
      {formation && formation.length > 0 && (
        <table>
          <caption>{t('player.formation')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('player.wordType')}</th>
              <th scope="col">{t('player.form')}</th>
              <th scope="col">{t('player.example')}</th>
            </tr>
          </thead>
          <tbody>
            {formation.map((row, i) => (
              <tr key={i}>
                <th scope="row">{row.wordType}</th>
                <td lang={lang}>{row.form}</td>
                <td lang={lang}>{row.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {props.card.words.length > 0 && (
        <section aria-labelledby={`words-${props.card.item.id}`}>
          <h3 id={`words-${props.card.item.id}`}>{t('player.wordsUsing', { term })}</h3>
          <WordList>
            {props.card.words.map((word) => {
              const fields = props.plugin.teachingCard(word, props.sectionLevel);
              return (
                <li key={word.id}>
                  <span lang={lang}>{fields.term}</span>
                  {fields.reading && <span lang={lang}>{fields.reading}</span>}
                  {fields.meaning && <span>{fields.meaning}</span>}
                </li>
              );
            })}
          </WordList>
        </section>
      )}
      {spoken && (
        <Speakers>
          <SpeakerButton what="word" reading={spoken} />
          <SpeakerButton what="word" reading={spoken} slow />
        </Speakers>
      )}
      {props.card.examples.map((example, i) => (
        <div key={i}>
          <dl>
            <div>
              <dt>{t('player.example')}</dt>
              <dd lang={lang}>{example.text}</dd>
              <dd>{example.translation}</dd>
            </div>
          </dl>
          <Speakers>
            <SpeakerButton what="example" reading={props.plugin.readingOf(example.tiles)} />
            <SpeakerButton what="example" reading={props.plugin.readingOf(example.tiles)} slow />
          </Speakers>
        </div>
      ))}
    </Card>
  );
}

/** FR-135: tells the player whether the device can speak, so it drops listening exercises. */
function SkipListening({ dispatch }: { dispatch: Dispatch<PlayerAction> }) {
  const { canSpeak } = useSpeech();
  useEffect(() => dispatch({ type: 'canSpeak', canSpeak }), [dispatch, canSpeak]);
  return null;
}

/**
 * DR-12: the tiles of an exercise's answer text, when its payload has any (typed, word bank, fill
 * blank) and it is in the course language. shortcut: a fill-blank speaks only the blank word, as
 * `before` and `after` have no stored readings; upgrade when they gain tiles.
 */
function answerTiles(payload: unknown): Tile[] {
  const { answer, accept, answerLanguage } = payload as {
    answer?: AnswerText;
    accept?: AnswerText[];
    answerLanguage?: string;
  };
  return answerLanguage === 'base' ? [] : ((answer ?? accept?.[0])?.tiles ?? []);
}

/**
 * FR-046, FR-047, FR-168, Product Spec section 4: the full-screen lesson player. At
 * `/unit/:unitId/test-out` it plays the unit's test-out instead (FR-024).
 */
/**
 * FR-053's accuracy, computed here for a preview (FR-224), which records nothing: the whole
 * percentage of first-pass responses the shared grader counts right (near-misses count).
 */
function previewAccuracy(
  session: PlayerSession,
  responses: ExerciseResponse[],
  plugin: LanguagePlugin,
) {
  const right = session.exercises.filter((exercise, i) => {
    try {
      return gradeResponse(exercise, responses[i]!, plugin).result !== 'wrong';
    } catch {
      return false;
    }
  }).length;
  return Math.round((100 * right) / session.exercises.length);
}

/** A review mixes courses, so each of its exercises names its own plugin. */
const pluginOf = (exercise: object) => (exercise as Partial<ReviewExercise>).plugin;
const unknownPlugin = (session: PlayerSession) =>
  ('plugin' in session ? [session.plugin] : session.exercises.map(pluginOf)).find(
    (id) => !plugins.has(id!),
  );

export default function LessonPlayerPage({
  preview = false,
  review = false,
}: {
  preview?: boolean;
  /** FR-114: plays a review session at /review/session; each answer is saved as it is given. */
  review?: boolean;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const { user } = useSession();
  const { lessonId = '', unitId = '' } = useParams();
  const [state, dispatch] = useReducer(lessonPlayerReducer, initialPlayerState);
  const { phase, session, error } = state;
  const bodyRef = useRef<HTMLElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  // FR-050: starting again within 24 hours resumes the same server session; leaving keeps it.
  useEffect(() => {
    let current = true;
    const params = { path: { id: unitId || lessonId } };
    const load: Promise<PlayerSession> = review
      ? api.POST('/api/v1/reviews/sessions', { body: {} })
      : preview
        ? api.POST('/api/v1/authoring/lessons/{id}/preview', { params, body: {} })
        : unitId
          ? api.POST('/api/v1/units/{id}/test-out', { params, body: {} })
          : api.POST('/api/v1/lessons/{id}/sessions', { params, body: {} });
    load.then(
      (loaded) => {
        if (!current) return;
        const unknown = unknownPlugin(loaded);
        dispatch(
          unknown === undefined
            ? { type: 'loaded', session: loaded }
            : { type: 'failed', error: new UnknownLanguagePluginError(unknown) },
        );
      },
      (err: unknown) => current && dispatch({ type: 'failed', error: err }),
    );
    return () => {
      current = false;
    };
  }, [api, lessonId, unitId, preview, review]);

  // FR-052: one key per session, so a retried or repeated completion is applied once.
  const { responses } = state;
  useEffect(() => {
    if (phase !== 'completing' || error || !session || !('plugin' in session)) return;
    const body = { responses: responses.filter((r): r is ExerciseResponse => r !== undefined) };
    if (!('id' in session)) {
      const accuracy = previewAccuracy(session, body.responses, plugins.get(session.plugin));
      return dispatch({ type: 'completed', completion: { accuracy } });
    }
    let current = true;
    const params = { path: { id: String(session.id) } };
    const done: Promise<PlayerCompletion> =
      'unitId' in session
        ? api.POST('/api/v1/test-out-sessions/{id}/complete', {
            params,
            body,
            idempotencyKey: `test-out-session-${session.id}`,
          })
        : api.POST('/api/v1/lesson-sessions/{id}/complete', {
            params,
            body,
            idempotencyKey: `lesson-session-${session.id}`,
          });
    done.then(
      (completion) => current && dispatch({ type: 'completed', completion }),
      (err: unknown) => current && dispatch({ type: 'failed', error: err }),
    );
    return () => {
      current = false;
    };
  }, [api, phase, error, session, responses]);

  const exerciseIndex = state.queue[0];
  const exercise = exerciseIndex === undefined ? undefined : session?.exercises[exerciseIndex];
  const pluginId =
    (exercise && pluginOf(exercise)) || (session && 'plugin' in session ? session.plugin : '');
  const plugin = pluginId ? plugins.get(pluginId) : undefined;

  // FR-114, FR-117: a review answer is saved as soon as it is final; the server grades it again
  // and says whether the exercise comes back at the end. The ref keeps StrictMode from posting twice.
  const [tally, setTally] = useState({ first: 0, right: 0, xp: 0 });
  const [savedAt, setSavedAt] = useState(-1); // the step whose answer the server has
  const [saveTry, setSaveTry] = useState(0);
  const savedStep = useRef<string | null>(null);
  useEffect(() => {
    if (!review || phase !== 'feedback' || !session || !exercise || exerciseIndex === undefined)
      return;
    const key = `${state.step}:${saveTry}`;
    if (savedStep.current === key) return;
    savedStep.current = key;
    api
      .POST('/api/v1/review-sessions/{id}/answers', {
        params: { path: { id: String((session as ReviewSession).id) } },
        body: { index: exerciseIndex, response: responses[exerciseIndex]! },
      })
      .then(
        (result) => {
          setSavedAt(state.step);
          const retry = 'retry' in exercise && exercise.retry;
          setTally((t) => ({
            first: t.first + (retry ? 0 : 1),
            right: t.right + (!retry && result.correct ? 1 : 0),
            xp: t.xp + result.xpEarned,
          }));
          if (result.retryIndex !== null) {
            dispatch({
              type: 'retryQueued',
              exercise: { ...(exercise as ReviewExercise), correct: null, retry: true },
            });
          }
        },
        (err: unknown) => {
          dispatch({ type: 'failed', error: err });
        },
      );
  }, [api, review, phase, state.step, saveTry]);
  const onAnswer = useCallback((answer: unknown) => dispatch({ type: 'answered', answer }), []);

  // Focus management: a new screen focuses its content, feedback focuses Continue.
  useEffect(() => {
    if (phase === 'feedback') actionRef.current?.focus();
    else bodyRef.current?.focus();
  }, [phase, state.step, state.card]);

  function act() {
    if (review && phase === 'feedback' && (savedAt !== state.step || error)) {
      // Continue waits for the save; after a failed save it tries again.
      if (error) {
        savedStep.current = null;
        setSaveTry((n) => n + 1);
        dispatch({ type: 'failed', error: null });
      }
      return;
    }
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

  // FR-167: effects play on feedback and on the results screen, if sound is on.
  const play = useSound();
  const outcome =
    phase === 'feedback' && grade ? (grade.result === 'wrong' ? 'wrong' : 'correct') : null;
  const inResults = phase === 'results';
  useEffect(() => {
    if (outcome) play(outcome);
  }, [outcome]);
  useEffect(() => {
    if (inResults) play('complete');
  }, [inResults]);

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
  } else if (phase === 'intro' && review && session) {
    content = (
      <>
        <h1>{t('area.review')}</h1>
        <p>{t('review.intro', { count: state.queue.length })}</p>
      </>
    );
    actionLabel = t('player.start');
  } else if (phase === 'intro' && session && 'unitId' in session) {
    // FR-024: a test-out names its unit, length and pass mark.
    content = (
      <>
        <h1>{t('testOut.title', { unit: session.unitTitle })}</h1>
        <p>
          {t('testOut.intro', { count: session.exercises.length, pass: TEST_OUT_PASS_ACCURACY })}
        </p>
      </>
    );
    actionLabel = t('player.start');
  } else if (phase === 'intro' && session && 'teachingCards' in session && plugin) {
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
  } else if (phase === 'teaching' && session && 'teachingCards' in session && plugin) {
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
        <WordBankAlternative
          key={state.step}
          type={exercise.type}
          payload={exercise.payload}
          plugin={plugin}
          preferred={user?.settings.preferWordBank ?? false}
          onAnswer={onAnswer}
        >
          <Renderer payload={exercise.payload} plugin={plugin} onAnswer={onAnswer} />
        </WordBankAlternative>
      </Suspense>
    );
    actionLabel = phase === 'feedback' ? t('player.continue') : t('player.check');
  }
  if (review && phase === 'feedback' && error) {
    actionLabel = t('player.retry');
  } else if (review && phase === 'completing') {
    // FR-114: every answer is already saved; this only summarises the session.
    content = (
      <>
        <Confetti />
        <h1>{t('review.done')}</h1>
        <p>
          {t('player.accuracy', {
            accuracy: Math.round((100 * tally.right) / Math.max(1, tally.first)),
          })}
        </p>
        <p>{t('results.xpEarned', { count: tally.xp })}</p>
      </>
    );
  } else if (phase === 'completing') {
    content = error ? <p role="alert">{apiErrorMessage(t, error)}</p> : <p>{t('player.saving')}</p>;
    actionLabel = t('player.retry');
  } else if (phase === 'results' && state.completion) {
    const { completion } = state;
    content = (
      <>
        {(!('passed' in completion) || completion.passed) && <Confetti />}
        <h1>
          {'passed' in completion
            ? t(completion.passed ? 'testOut.passed' : 'testOut.failed', {
                pass: TEST_OUT_PASS_ACCURACY,
              })
            : t('area.lesson')}
        </h1>
        <p>{t('player.accuracy', { accuracy: completion.accuracy })}</p>
        {'xpEarned' in completion ? (
          <LessonResults xpEarned={completion.xpEarned} totalXp={completion.totalXp} />
        ) : (
          <p>{t('lessonEditor.previewNote')}</p>
        )}
      </>
    );
  }

  const total = session?.exercises.length ?? 0;
  const exit = review ? '/review' : preview ? `/authoring/lessons/${lessonId}` : '/learn';
  const showAction =
    ['intro', 'teaching', 'answering', 'feedback'].includes(phase) ||
    (phase === 'completing' && !review && !!error);
  const actionDisabled =
    (phase === 'answering' && state.answer === undefined) ||
    (review && phase === 'feedback' && savedAt !== state.step && !error);

  // FR-054: a wrong typed answer can be reported as one that should be accepted. A preview has no
  // session to report from.
  const lastAnswer = state.attempts.at(-1);
  const reportable =
    phase === 'feedback' &&
    grade?.result === 'wrong' &&
    !!session &&
    'id' in session &&
    !!exercise &&
    acceptsAnswerReports(exercise) &&
    typeof lastAnswer === 'string' &&
    // A test-out has no lesson to pin into: a generated exercise there needs an item to pin at.
    // shortcut: this also hides authored test-out exercises that name no item; keep each
    // exercise's lesson in the test-out state if those need reports.
    !('unitId' in session && payloadItemIds(exercise.payload).length === 0);

  // FR-135: hear the answer after feedback; choice exercises have no tiles, so no button yet.
  const answerReading =
    phase === 'feedback' && exercise && plugin
      ? plugin.readingOf(answerTiles(exercise.payload))
      : '';

  return (
    <SpeechProvider locale={plugin?.ttsVoice.locale ?? ''}>
      <Screen onKeyDown={onKeyDown}>
        {/* shortcut: a review plays every served exercise, as the server saves answers by index; upgrade with listening facets (EX-07, EX-08). */}
        {session && !review && <SkipListening dispatch={dispatch} />}
        <Top>
          <Close to={exit} aria-label={t('player.close')}>
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
        {reportable && (
          <ReportAnswerButton
            key={state.step}
            session={{ kind: review ? 'review' : 'lesson', id: session.id }}
            exercise={exercise}
            answer={lastAnswer}
            onSent={() => actionRef.current?.focus()}
          />
        )}
        {answerReading && (
          <Speakers>
            <SpeakerButton what="answer" reading={answerReading} />
            <SpeakerButton what="answer" reading={answerReading} slow />
          </Speakers>
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
        {(phase === 'results' || (review && phase === 'completing')) && (
          <DoneLink to={exit}>{t('player.done')}</DoneLink>
        )}
      </Screen>
    </SpeechProvider>
  );
}

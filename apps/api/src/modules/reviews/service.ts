import type { Pool } from 'pg';
import {
  FixedLadderScheduler,
  KANA_LESSON_START_STAGE,
  REVIEW_SESSION_ITEMS,
  SecondAttemptError,
  gradeResponse,
  payloadItemIds,
  reviewSessionStateSchema,
  z,
} from '@manabi/core';
import type {
  Item,
  LanguagePlugin,
  LessonType,
  ReviewAnswerRequest,
  ReviewAnswerResult,
  ReviewSession,
  ReviewSessionState,
  ReviewSummary,
  SessionExercise,
} from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import { languagePlugins } from '../../plugins';
import type { ScopedUserId } from '../auth/service';
import type { ItemRow } from '../content/rows';
import { awardXp } from '../courses/service';
import { toItem } from '../lessons/service';
import * as q from './queries';
import type { ReviewSessionRow, Stage } from './rows';

// Review entries, review sessions and answers (FR-110 to FR-114, FR-117; SDD sections 6 and 7).

const HOUR = 3_600_000;

/**
 * Due items read at a time to fill one session. Items with a facet no exercise can be built for
 * are skipped (they stay due), so the session pages past them instead of stalling on them.
 */
const DUE_PAGE_ITEMS = 100;

/**
 * FR-110: inside the lesson-completion transaction, a review entry per facet for each of the
 * lesson's new items. A kana lesson's items start at stage 4 (Product Spec section 7), the rest
 * at stage 1; each is due after its stage's interval. A replay keeps existing entries.
 */
export async function createReviewEntries(
  db: Queryable,
  userId: number,
  lessonType: LessonType,
  items: readonly Pick<ItemRow, 'id' | 'type'>[],
  plugin: LanguagePlugin,
  intervalHours: readonly number[],
  now = new Date(),
): Promise<void> {
  const entries = items.flatMap((item) =>
    Object.keys(plugin.reviewFacets(item.type)).map((facet) => ({ itemId: item.id, facet })),
  );
  if (entries.length === 0) return;
  const stage = (lessonType === 'kana' ? KANA_LESSON_START_STAGE : 1) as Stage;
  const dueAt = new Date(now.getTime() + intervalHours[stage - 1]! * HOUR);
  await q.insertReviewEntries(db, userId, entries, stage, dueAt);
}

/**
 * FR-110: when a plugin adds a review facet to an item type (#53: kanji meaning), items already
 * in reviews get an entry for it at their current stage and due time (their lowest-stage facet's),
 * so they are reviewed on it without starting over. Runs at API start; existing entries are kept.
 */
export async function backfillReviewFacets(db: Queryable): Promise<void> {
  const facets = languagePlugins.codes().flatMap((code) => {
    const plugin = languagePlugins.get(code);
    return Object.keys(plugin.itemSchemas).flatMap((itemType) =>
      Object.keys(plugin.reviewFacets(itemType)).map((facet) => ({
        plugin: code,
        itemType,
        facet,
      })),
    );
  });
  if (facets.length > 0) await q.insertMissingFacets(db, facets);
}

/** FR-113: items due now and the 7-day forecast in the learner's time zone. */
export async function getSummary(
  db: Pool,
  userId: ScopedUserId,
  now = new Date(),
): Promise<ReviewSummary> {
  return {
    dueNow: await q.countDueItems(db, userId, now),
    forecast: await q.forecastDueItems(db, userId, now),
  };
}

function pickRandom<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

function toSession(row: ReviewSessionRow, state: ReviewSessionState): ReviewSession {
  return {
    id: row.id,
    expiresAt: row.expires_at.toISOString(),
    // The response and course stay on the server.
    exercises: state.exercises.map(({ response: _r, courseId: _c, ...e }) => e),
  };
}

/**
 * FR-114, NFR-02: the learner's unexpired review session, or a new one of up to 20 due items,
 * oldest due first. Each due facet of an item gets one exercise of a type suited to it: a stored
 * one when there is one, else generated. 409 when nothing due can be reviewed.
 */
export async function startSession(
  db: Pool,
  userId: ScopedUserId,
  now = new Date(),
): Promise<ReviewSession> {
  return withTransaction(db, async (client) => {
    await q.lockReviewSessions(client, userId);
    const open = await q.resumeReviewSession(client, userId);
    if (open) return toSession(open, reviewSessionStateSchema.parse(open.state));

    const state = await buildState(client, userId, now);
    if (state.exercises.length === 0) throw new AppError('conflict', 'No reviews are due');
    return toSession(await q.replaceReviewSession(client, userId, state), state);
  });
}

async function buildState(db: Queryable, userId: number, now: Date): Promise<ReviewSessionState> {
  const learned = new Map<number, Item[]>();
  const exercises: ReviewSessionState['exercises'] = [];
  let items = 0;
  for (let offset = 0; items < REVIEW_SESSION_ITEMS; offset += DUE_PAGE_ITEMS) {
    const due = await q.listDueItemFacets(db, userId, now, DUE_PAGE_ITEMS, offset);
    if (due.length === 0) break;
    const byItem = new Map<number, q.DueFacetRow[]>();
    for (const row of due) byItem.set(row.id, [...(byItem.get(row.id) ?? []), row]);
    const stored = await q.listStoredReviewExercises(db, [...byItem.keys()]);

    for (const [itemId, facets] of byItem) {
      if (items === REVIEW_SESSION_ITEMS) break;
      const { course_id: courseId, plugin: pluginCode } = facets[0]!;
      const sectionLevel = facets[0]!.section_level ?? facets[0]!.level_code ?? '';
      const plugin = languagePlugins.get(pluginCode);
      if (!learned.has(courseId)) {
        learned.set(courseId, (await q.listLearnedItems(db, userId, courseId)).map(toItem));
      }
      const taughtItems = learned.get(courseId)!;
      const taught = new Set(taughtItems.map((i) => i.id));
      const item = toItem(facets[0]!);

      const picked = facets.map((row): SessionExercise | undefined => {
        const types = plugin.reviewFacets(item.type)[row.facet] ?? [];
        const own = stored.filter(
          (e) =>
            e.for_item_id === itemId &&
            types.includes(e.type) &&
            (plugin.testsFacet?.({ type: e.type, payload: e.payload }, item.type, row.facet) ??
              true),
        );
        const storedPick = pickRandom(own);
        if (storedPick) return { type: storedPick.type, payload: storedPick.payload };
        // FR-048: generated exercises use the learner's items only.
        for (const type of [...types].sort(() => Math.random() - 0.5)) {
          const generate = Object.hasOwn(plugin.generators, type) ? plugin.generators[type] : null;
          const made = (generate?.(item, {
            sectionLevel,
            taughtItems,
            sentences: [],
            facet: row.facet,
          }) ?? []) as SessionExercise[];
          const fit = made.find((e) => payloadItemIds(e.payload).every((id) => taught.has(id)));
          if (fit) return fit;
        }
        return undefined;
      });
      // FR-112: an item is reviewed on all its due facets or not at all.
      if (picked.some((e) => e === undefined)) continue;
      picked.forEach((e, i) =>
        exercises.push({
          ...e!,
          itemId,
          facet: facets[i]!.facet,
          plugin: pluginCode,
          courseId,
          correct: null,
          retry: false,
        }),
      );
      items++;
    }
  }
  return { exercises };
}

/** The server's grade of one response; near-misses count as right (FR-053). */
function isRight(exercise: SessionExercise, body: ReviewAnswerRequest, plugin: LanguagePlugin) {
  try {
    return gradeResponse(exercise, body.response, plugin).result !== 'wrong';
  } catch (err) {
    // A malformed answer, or a second attempt that was not allowed; anything else is a 500.
    if (!(err instanceof z.ZodError || err instanceof SecondAttemptError)) throw err;
    throw new AppError('validation_failed', 'The response is not a valid answer', [
      { location: 'body', path: ['response'], message: 'Not a valid answer' },
    ]);
  }
}

/**
 * FR-112, FR-114, FR-117, NFR-20: grades one answer on the server and saves it in one
 * transaction. A wrong answer queues its exercise again at the end of the session until it is
 * right; only the first answer of each exercise counts, and only it appends a review_log row.
 * Once all of an item's facets in the session are answered, the whole item moves: up one stage
 * when every facet was right (plus review XP), down when any was wrong. The log row of that last
 * answer shows the move; earlier ones show none. Stopping mid-session keeps every settled item.
 */
export async function answer(
  db: Pool,
  userId: ScopedUserId,
  sessionId: number,
  body: ReviewAnswerRequest,
  intervalHours: readonly number[],
  now = new Date(),
): Promise<ReviewAnswerResult> {
  return withTransaction(db, async (client) => {
    const session = await q.lockOwnReviewSession(client, userId, sessionId);
    if (!session) throw new AppError('not_found', 'Review session not found');
    const state = reviewSessionStateSchema.parse(session.state);
    const exercise = state.exercises[body.index];
    if (!exercise) {
      throw new AppError('validation_failed', 'No exercise at this index', [
        { location: 'body', path: ['index'], message: `Expected below ${state.exercises.length}` },
      ]);
    }
    if (exercise.correct !== null) {
      throw new AppError('conflict', 'This exercise is already answered');
    }

    const correct = isRight(exercise, body, languagePlugins.get(exercise.plugin));
    exercise.correct = correct;
    exercise.response = body.response;
    const retryIndex = correct
      ? null
      : state.exercises.push({ ...exercise, response: undefined, correct: null, retry: true }) - 1;
    const save = () =>
      state.exercises.every((e) => e.correct !== null)
        ? q.deleteReviewSession(client, session.id)
        : q.saveReviewSessionState(client, session.id, state);
    if (exercise.retry) {
      await save();
      return { correct, stage: null, xpEarned: 0, retryIndex };
    }

    const { itemId, facet } = exercise;
    const row = await q.recordFacetAnswer(client, userId, itemId, facet, correct);
    if (!row) throw new AppError('conflict', 'This item is no longer in reviews');

    const siblings = state.exercises.filter((e) => e.itemId === itemId && !e.retry);
    let next: { stage: Stage; dueAt: Date | null } | null = null;
    if (siblings.every((e) => e.correct !== null)) {
      const right = siblings.every((e) => e.correct);
      // An item's facets share one stage: they are created together and always moved together.
      const scheduled = new FixedLadderScheduler(intervalHours).next(row.stage, right, now);
      next = { stage: scheduled.stage as Stage, dueAt: scheduled.dueAt };
      for (const e of siblings) {
        await q.setFacetStage(client, userId, itemId, e.facet, next.stage, next.dueAt);
      }
    }
    const log = await q.insertReviewLog(client, {
      userId,
      itemId,
      facet,
      exerciseType: exercise.type,
      correct,
      stageBefore: row.stage,
      stageAfter: next?.stage ?? row.stage,
    });
    let xpEarned = 0;
    if (next && siblings.every((e) => e.correct)) {
      const xp = await awardXp(client, {
        userId,
        courseId: exercise.courseId,
        reason: 'review_correct',
        refId: log.id,
        at: now,
      });
      xpEarned = xp.xpEarned;
    }
    const stage = next?.stage ?? null;

    await save();
    return { correct, stage, xpEarned, retryIndex };
  });
}

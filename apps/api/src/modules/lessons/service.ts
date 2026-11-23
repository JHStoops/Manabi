import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import {
  LESSON_MAX_EXERCISES,
  LESSON_MIN_EXERCISES,
  UnknownExerciseTypeError,
  gradeResponse,
  lessonCompletionSchema,
  lessonRecipes,
  lessonSessionStateSchema,
  payloadItemIds,
} from '@manabi/core';
import type {
  Item,
  LessonCompletion,
  LessonCompletionRequest,
  LessonSession,
  LessonSessionState,
  SessionExercise,
} from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import { languagePlugins } from '../../plugins';
import type { ScopedUserId } from '../auth/service';
import type { ItemRow } from '../content/rows';
import { awardLessonXp, getPath } from '../courses/service';
import * as q from './queries';

// Lesson sessions: build, save, resume and complete (FR-041, FR-048, FR-050, FR-051 to FR-053,
// FR-056; SDD sections 6 and 7).

/** JSON with object keys sorted, so equal values compare equal (jsonb reorders keys). */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    courseId: row.course_id,
    key: row.key,
    type: row.type,
    levelCode: row.level_code,
    data: row.data,
    overrides: row.overrides,
    source: row.source,
    datasetVersion: row.dataset_version,
    archivedAt: row.archived_at?.toISOString() ?? null,
  };
}

/**
 * FR-041, FR-050: the learner's unexpired session for the lesson, or a new one built and saved
 * for 24 hours. Only lessons the learner can see and has unlocked can be started.
 */
export async function startSession(
  db: Pool,
  userId: ScopedUserId,
  lessonId: number,
): Promise<LessonSession> {
  const lesson = await q.findLesson(db, lessonId);
  if (!lesson) throw new AppError('not_found', 'Lesson not found');
  const path = await getPath(db, userId, lesson.course_id, false);
  const state = path.sections
    .flatMap((s) => s.units)
    .flatMap((u) => u.lessons)
    .find((l) => l.id === lessonId)?.state;
  if (!state) throw new AppError('not_found', 'Lesson not found');
  if (state === 'locked') throw new AppError('forbidden', 'This lesson is still locked');

  const row = await withTransaction(db, async (client) => {
    await q.lockLessonSessions(client, userId, lessonId);
    return (
      (await q.findOpenSession(client, userId, lessonId)) ??
      q.insertSession(client, userId, lessonId, await buildState(client, lesson))
    );
  });
  return {
    id: row.id,
    lessonId: row.lesson_id,
    expiresAt: row.expires_at.toISOString(),
    ...lessonSessionStateSchema.parse(row.state),
  };
}

/**
 * SDD section 6: teaching cards for the new items, then the stored exercises, filled up to 10 by
 * the plugin's generators per the lesson type's recipe. Exercises use taught items only (FR-048).
 */
async function buildState(db: Queryable, lesson: q.LessonContextRow): Promise<LessonSessionState> {
  const plugin = languagePlugins.get(lesson.plugin);
  const newItems = (await q.listLessonItems(db, lesson.id)).map(toItem);
  const taughtItems = (await q.listTaughtItems(db, lesson.id)).map(toItem);
  const taught = new Set(taughtItems.map((i) => i.id));
  const usesTaughtOnly = (payload: unknown) =>
    payloadItemIds(payload).every((id) => taught.has(id));

  // No two exercises in a session are identical (same type and deeply equal payload).
  const exercises: SessionExercise[] = [];
  const seen = new Set<string>();
  const add = (e: SessionExercise) => {
    const key = stableJson(e);
    if (seen.has(key) || exercises.length >= LESSON_MAX_EXERCISES) return false;
    seen.add(key);
    exercises.push(e);
    return true;
  };
  for (const e of await q.listStoredExercises(db, lesson.id)) {
    if ((e.item_id === null || taught.has(e.item_id)) && usesTaughtOnly(e.payload)) {
      add({ type: e.type, payload: e.payload });
    }
  }

  const generators = lessonRecipes[lesson.type].flatMap((type) =>
    Object.hasOwn(plugin.generators, type) ? [plugin.generators[type]!] : [],
  );
  if (generators.length > 0 && exercises.length < LESSON_MIN_EXERCISES) {
    const sentences = await q.listSentences(
      db,
      lesson.course_id,
      lesson.level_code,
      newItems.map((i) => i.id),
      [...taught],
    );
    const context = { sectionLevel: lesson.level_code, taughtItems, sentences };
    // Rounds over the recipe's types and the new items until full, or a round adds nothing new.
    for (let added = true; added && exercises.length < LESSON_MIN_EXERCISES;) {
      added = false;
      for (const generate of generators) {
        for (const item of newItems) {
          for (const e of generate(item, context) as SessionExercise[]) {
            if (exercises.length >= LESSON_MIN_EXERCISES) break;
            if (usesTaughtOnly(e.payload) && add(e)) added = true;
          }
        }
      }
    }
  }

  if (exercises.length < LESSON_MIN_EXERCISES) {
    throw new AppError('conflict', 'This lesson does not have enough exercises yet', {
      exercises: exercises.length,
      required: LESSON_MIN_EXERCISES,
    });
  }
  return lessonSessionStateSchema.parse({
    teachingCards: newItems.map((item) => ({ item })),
    exercises,
  });
}

/**
 * FR-051 to FR-053, NFR-20: completes the learner's session in one transaction. The server
 * re-grades every response with the shared grader; then it records lesson progress, awards XP,
 * records a finished unit and uses the session up. With an Idempotency-Key, a repeat of the same
 * request gets the first response and changes nothing (FR-052).
 */
export async function completeSession(
  db: Pool,
  userId: ScopedUserId,
  sessionId: number,
  body: LessonCompletionRequest,
  idempotencyKey: string | undefined,
): Promise<LessonCompletion> {
  const requestHash = createHash('sha256').update(stableJson({ sessionId, body })).digest('hex');
  return withTransaction(db, async (client) => {
    if (idempotencyKey !== undefined) {
      await q.lockIdempotencyKey(client, userId, idempotencyKey);
      const saved = await q.findIdempotencyKey(client, userId, idempotencyKey);
      if (saved) {
        if (saved.request_hash !== requestHash) {
          throw new AppError(
            'idempotency_conflict',
            'This Idempotency-Key was already used for a different request',
          );
        }
        return lessonCompletionSchema.parse(saved.response);
      }
    }

    const session = await q.lockOwnSession(client, userId, sessionId);
    if (!session) throw new AppError('not_found', 'Lesson session not found');
    const lesson = await q.findLesson(client, session.lesson_id);
    if (!lesson) throw new AppError('not_found', 'Lesson not found');
    const { exercises } = lessonSessionStateSchema.parse(session.state);
    if (body.responses.length !== exercises.length) {
      throw new AppError('validation_failed', 'Send one response per exercise', [
        {
          location: 'body',
          path: ['responses'],
          message: `Expected ${exercises.length} responses`,
        },
      ]);
    }

    // FR-053: the server's grade decides; near-misses count as right.
    const plugin = languagePlugins.get(lesson.plugin);
    const right = exercises.filter((exercise, i) => {
      try {
        return gradeResponse(exercise, body.responses[i]!, plugin).result !== 'wrong';
      } catch (err) {
        if (err instanceof UnknownExerciseTypeError) throw err;
        throw new AppError('validation_failed', 'A response is not a valid answer', [
          { location: 'body', path: ['responses', i], message: 'Not a valid answer' },
        ]);
      }
    }).length;
    const accuracy = Math.round((100 * right) / exercises.length);

    await q.upsertLessonProgress(client, userId, lesson.id, accuracy);
    const xp = await awardLessonXp(client, userId, lesson.id, accuracy);
    await q.insertUnitCompletionIfDone(client, userId, lesson.id);
    // Review entries for the new items (FR-110), the streak (FR-163, #38) and achievements are
    // not built yet; each joins this transaction here when its issue lands.
    await q.deleteSession(client, session.id);

    const result: LessonCompletion = {
      lessonId: lesson.id,
      accuracy,
      ...xp,
      path: await getPath(client, userId, lesson.course_id, false),
    };
    if (idempotencyKey !== undefined) {
      await q.insertIdempotencyKey(client, userId, idempotencyKey, requestHash, result);
    }
    return result;
  });
}

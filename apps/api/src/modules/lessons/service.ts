import type { Pool } from 'pg';
import {
  LESSON_MAX_EXERCISES,
  LESSON_MIN_EXERCISES,
  lessonRecipes,
  lessonSessionStateSchema,
  payloadItemIds,
} from '@manabi/core';
import type { Item, LessonSession, LessonSessionState, SessionExercise } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import { languagePlugins } from '../../plugins';
import type { ScopedUserId } from '../auth/service';
import type { ItemRow } from '../content/rows';
import { getPath } from '../courses/service';
import * as q from './queries';

// Lesson sessions: build, save and resume (FR-041, FR-048, FR-050, FR-056; SDD section 6).

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

  const exercises: SessionExercise[] = (await q.listStoredExercises(db, lesson.id))
    .filter((e) => (e.item_id === null || taught.has(e.item_id)) && usesTaughtOnly(e.payload))
    .slice(0, LESSON_MAX_EXERCISES)
    .map((e) => ({ type: e.type, payload: e.payload }));

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
    // Rounds over the recipe's types and the new items until full, or a round adds nothing.
    for (let added = true; added && exercises.length < LESSON_MIN_EXERCISES;) {
      added = false;
      for (const generate of generators) {
        for (const item of newItems) {
          const room = LESSON_MIN_EXERCISES - exercises.length;
          if (room <= 0) break;
          const made = generate(item, context).filter((e) => usesTaughtOnly(e.payload));
          exercises.push(...(made.slice(0, room) as SessionExercise[]));
          added ||= made.length > 0;
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

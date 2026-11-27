import type { Pool } from 'pg';
import {
  findBlockedWords,
  getExerciseType,
  payloadItemIds,
  UnknownExerciseTypeError,
  WORD_BANK_TYPE,
} from '@manabi/core';
import type {
  CreateExerciseRequest,
  EditorExercise,
  ExerciseWrite,
  GeneratedExercises,
  LanguagePlugin,
  LessonEditor,
  LessonPreview,
  SetLessonItemsRequest,
  Tile,
  UpdateExerciseRequest,
} from '@manabi/core';
import { segmentText } from '@manabi/importers';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import { languagePlugins } from '../../plugins';
import { textFields } from '../content/lint';
import { listBlockedWords, replaceLessonItems } from '../content/queries';
import type { ExerciseRow, JsonObject } from '../content/rows';
import { objectsIn } from '../content/service';
import { listLessonItems, listStoredExercises } from '../lessons/queries';
import { generateExercises, previewLesson, toItem } from '../lessons/service';
import * as q from './lessonEditorQueries';
import { deleteOrArchive } from './service';

// The lesson editor (FR-223, FR-224, FR-237, FR-238, Product Spec section 11): a lesson's new
// items, its authored and pinned exercises, generated exercises to pin, and a preview. Nothing
// here writes to a progress table.

function notFound(what: string): never {
  throw new AppError('not_found', `${what} not found`);
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function toEditorExercise(row: ExerciseRow): EditorExercise {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    origin: row.origin as EditorExercise['origin'],
    key: row.key,
  };
}

async function activeLesson(db: Queryable, id: number) {
  return (await q.findEditorLesson(db, id)) ?? notFound('Lesson');
}

/** The lesson, its new items in order and its stored exercises in session order. */
export async function getLessonEditor(db: Queryable, lessonId: number): Promise<LessonEditor> {
  const l = await activeLesson(db, lessonId);
  return {
    lesson: {
      id: l.id,
      unitId: l.unit_id,
      key: l.key,
      position: l.position,
      type: l.type,
      title: l.title,
      status: l.status,
      courseId: l.course_id,
      plugin: l.plugin,
      sectionLevel: l.level_code,
    },
    items: (await listLessonItems(db, lessonId)).map(toItem),
    exercises: (await listStoredExercises(db, lessonId)).map(toEditorExercise),
  };
}

/** Rejects item ids that are not active items of the course, naming the request field. */
async function checkItems(db: Queryable, courseId: number, ids: number[], path: string) {
  const unique = [...new Set(ids)];
  if ((await q.countCourseItems(db, courseId, unique)) !== unique.length) {
    throw new AppError('validation_failed', 'Unknown item', [
      { location: 'body', path: [path], message: 'Not an item of this course' },
    ]);
  }
}

/** Makes the lesson's new items exactly `itemIds`, in that order. */
export async function setLessonItems(
  pool: Pool,
  lessonId: number,
  body: SetLessonItemsRequest,
): Promise<LessonEditor> {
  await withTransaction(pool, async (db) => {
    const lesson = await activeLesson(db, lessonId);
    await checkItems(db, lesson.course_id, body.itemIds, 'itemIds');
    await replaceLessonItems(db, lessonId, body.itemIds);
  });
  return getLessonEditor(pool, lessonId);
}

export async function getGenerated(db: Queryable, lessonId: number): Promise<GeneratedExercises> {
  await activeLesson(db, lessonId);
  return { exercises: await generateExercises(db, lessonId) };
}

export async function getPreview(db: Queryable, lessonId: number): Promise<LessonPreview> {
  await activeLesson(db, lessonId);
  return previewLesson(db, lessonId);
}

/** Answer text sent without tiles, or with none, is segmented. */
const untiled = (answer: JsonObject) => !Array.isArray(answer.tiles) || answer.tiles.length === 0;

const segment = async (plugin: LanguagePlugin, text: string): Promise<Tile[]> =>
  (await segmentText(plugin, text)).map(({ counted: _, ...tile }) => tile);

/**
 * FR-238, DR-12: fills in the tiles of the payload's answer text (accept-list answers, and a word
 * bank's answer) that come without tiles, or all of them on `resegment`. Tiles sent are kept, as
 * the author may have edited them. A word bank whose tiles change gets their order as its only
 * accepted order, since accepted orders index the tiles.
 */
export async function fillTiles(
  plugin: LanguagePlugin,
  type: string,
  payload: JsonObject,
  resegment: boolean,
): Promise<void> {
  const accept: unknown[] = Array.isArray(payload.accept) ? payload.accept : [];
  for (const answer of accept) {
    if (isObject(answer) && typeof answer.text === 'string' && (resegment || untiled(answer)))
      answer.tiles = await segment(plugin, answer.text);
  }
  const { answer } = payload;
  if (type === WORD_BANK_TYPE && isObject(answer) && typeof answer.text === 'string') {
    if (resegment || untiled(answer)) {
      const tiles = await segment(plugin, answer.text);
      if (JSON.stringify(tiles) !== JSON.stringify(answer.tiles)) {
        answer.tiles = tiles;
        payload.acceptedOrders = [tiles.map((_, i) => i)];
      }
    }
  }
}

/** FR-223: the payload with its tiles filled in, validated by its exercise type's schema. */
async function preparePayload(
  db: Queryable,
  lesson: q.EditorLessonRow,
  type: string,
  body: { payload: JsonObject; resegment?: boolean | undefined },
): Promise<{ payload: JsonObject; blockedWords: string[] }> {
  const plugin = languagePlugins.get(lesson.plugin);
  const payload = structuredClone(body.payload);
  let definition;
  try {
    definition = getExerciseType(type);
  } catch (err) {
    if (!(err instanceof UnknownExerciseTypeError)) throw err;
    throw new AppError('validation_failed', err.message, [
      { location: 'body', path: ['type'], message: 'Unknown exercise type' },
    ]);
  }
  await fillTiles(plugin, type, payload, body.resegment ?? false);
  const result = definition.payloadSchema.safeParse(payload);
  if (!result.success) {
    throw new AppError(
      'validation_failed',
      'The payload is not valid for this exercise type',
      result.error.issues.map((i) => ({
        location: 'body',
        path: ['payload', ...i.path.map((k) => (typeof k === 'symbol' ? String(k) : k))],
        message: i.message,
      })),
    );
  }
  await checkItems(db, lesson.course_id, payloadItemIds(payload), 'payload');

  // FR-237: a warning, not an error: blocklist words in the tiles or in the other text fields.
  const blocked = new Set(await listBlockedWords(db, lesson.target_lang));
  const found = new Set<string>();
  if (blocked.size > 0) {
    const tiles = objectsIn(payload, (o) => typeof o.surface === 'string') as Tile[];
    for (const word of findBlockedWords(tiles, blocked)) found.add(word);
    for (const { text } of textFields(payload)) {
      for (const word of findBlockedWords(await segment(plugin, text), blocked)) found.add(word);
    }
  }
  return { payload, blockedWords: [...found] };
}

/** FR-223: adds a hand-written or pinned exercise at the end of the lesson. */
export async function createExercise(
  pool: Pool,
  body: CreateExerciseRequest,
): Promise<ExerciseWrite> {
  const lesson = await activeLesson(pool, body.lessonId);
  const { payload, blockedWords } = await preparePayload(pool, lesson, body.type, body);
  let row;
  try {
    row = await q.insertExercise(pool, { ...body, payload });
  } catch (err) {
    if ((err as { code?: string }).code !== '23505') throw err;
    throw new AppError('conflict', 'A content pack exercise in this lesson already has that key');
  }
  return { exercise: toEditorExercise(row), blockedWords };
}

/** FR-223: replaces an exercise's payload; its type stays. */
export async function updateExercise(
  pool: Pool,
  id: number,
  body: UpdateExerciseRequest,
): Promise<ExerciseWrite> {
  const row = (await q.findLessonExercise(pool, id)) ?? notFound('Exercise');
  const lesson = await activeLesson(pool, row.lesson_id!);
  const { payload, blockedWords } = await preparePayload(pool, lesson, row.type, body);
  const updated = await q.updateExercisePayload(pool, id, payload);
  return { exercise: toEditorExercise(updated), blockedWords };
}

/** FR-223: removes an exercise; archived instead when an answer report refers to it. */
export async function deleteExercise(pool: Pool, id: number): Promise<LessonEditor> {
  const lessonId = await withTransaction(pool, async (db) => {
    const row = (await q.findLessonExercise(db, id)) ?? notFound('Exercise');
    await activeLesson(db, row.lesson_id!);
    await deleteOrArchive(
      db,
      () => q.deleteExercise(db, id),
      () => q.archiveExercise(db, id),
    );
    return row.lesson_id!;
  });
  return getLessonEditor(pool, lessonId);
}

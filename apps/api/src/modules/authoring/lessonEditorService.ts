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
  Item,
  ItemExercises,
  LanguagePlugin,
  LessonEditor,
  LessonPreview,
  PinContent,
  RetieExercise,
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
import { generateExercises, lessonPinContent, previewLesson, toItem } from '../lessons/service';
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

function toEditorExercise(row: ExerciseRow, scope?: PinScope): EditorExercise {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    origin: row.origin as EditorExercise['origin'],
    key: row.key,
    detached: !!scope && isDetached(scope, row),
  };
}

/**
 * #259, SDD section 6: what pins of one lesson, or of one item, are checked against: the items a
 * pin can be about and the learner-independent content their generators draw on.
 */
interface PinScope {
  plugin: LanguagePlugin;
  items: Item[];
  content: PinContent;
}

/** A lesson's pins: about one of its new items, generated from the content up to the lesson. */
async function lessonPinScope(db: Queryable, lessonId: number): Promise<PinScope> {
  const { plugin, newItems, content } = await lessonPinContent(db, lessonId);
  return { plugin, items: newItems, content };
}

/**
 * An item's own pins (reviews): generated for the item with any of the course's items taught
 * and no sentences, as reviews generate them, at the level of the section that first teaches it.
 */
// shortcut: loads every item of the course; fine for an admin page at course sizes so far
// (a few thousand items), narrow it if the item editor gets slow.
async function itemPinScope(db: Queryable, itemId: number): Promise<PinScope> {
  const row = (await q.findPinItem(db, itemId)) ?? notFound('Item');
  const { plugin: code } = await activeItem(db, itemId);
  const item = toItem(row);
  return {
    plugin: languagePlugins.get(code),
    items: [item],
    content: {
      sectionLevel: row.section_level ?? row.level_code ?? '',
      items: (await q.listCourseItems(db, row.course_id)).map(toItem),
      sentences: [],
    },
  };
}

const scopeFor = (db: Queryable, row: ExerciseRow) =>
  row.lesson_id !== null ? lessonPinScope(db, row.lesson_id) : itemPinScope(db, row.item_id!);

/** The scope's items a pin's original can be about: those it names, else all of them. */
function pinItems(scope: PinScope, original: JsonObject): Item[] {
  const named = new Set(payloadItemIds(original));
  const about = scope.items.filter((i) => named.has(i.id) || i.key === original.itemKey);
  return about.length > 0 ? about : scope.items;
}

/**
 * #259: a pin is detached when the plugin says its generators can no longer ask its recorded
 * original about any item it can be about. A plugin without `regenerates` never marks one.
 */
function isDetached(scope: PinScope, row: ExerciseRow): boolean {
  const { plugin, content } = scope;
  if (row.origin !== 'pinned' || !plugin.regenerates) return false;
  const original = { type: row.type, payload: row.original_payload ?? row.payload };
  return !pinItems(scope, original.payload).some((item) =>
    plugin.regenerates!(original, item, content),
  );
}

/** Editor rows, with the detached mark worked out only when there are pins. */
async function toEditorExercises(
  rows: ExerciseRow[],
  scope: () => Promise<PinScope>,
): Promise<EditorExercise[]> {
  const pins = rows.some((r) => r.origin === 'pinned') ? await scope() : undefined;
  return rows.map((row) => toEditorExercise(row, pins));
}

/** One exercise's editor row, with its detached mark. */
async function editorRow(db: Queryable, row: ExerciseRow): Promise<EditorExercise> {
  return toEditorExercise(row, row.origin === 'pinned' ? await scopeFor(db, row) : undefined);
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
    exercises: await toEditorExercises(await listStoredExercises(db, lessonId), () =>
      lessonPinScope(db, lessonId),
    ),
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

export const segment = async (plugin: LanguagePlugin, text: string): Promise<Tile[]> =>
  (await segmentText(plugin, text)).map(({ counted: _, ...tile }) => tile);

/**
 * FR-238, DR-12: fills in the tiles of the payload's answer text (accept-list answers, and a word
 * bank's answer) that come without tiles, or all of them on `resegment`; base-language answers
 * get none. Tiles sent are kept, as
 * the author may have edited them. A word bank whose tiles change gets their order as its only
 * accepted order, since accepted orders index the tiles.
 */
async function fillTiles(
  plugin: LanguagePlugin,
  type: string,
  payload: JsonObject,
  resegment: boolean,
): Promise<void> {
  // Answers in the base language (an English meaning) are not segmented, as accepting an answer
  // report leaves them (FR-229).
  const accept: unknown[] =
    Array.isArray(payload.accept) && payload.answerLanguage !== 'base' ? payload.accept : [];
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
  lesson: Pick<q.EditorLessonRow, 'plugin' | 'course_id' | 'target_lang'>,
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
    // #254: a pin's original is the generated payload the author pinned, before any edit or
    // segmenting.
    row = await q.insertExercise(pool, {
      ...body,
      payload,
      original: body.original ?? body.payload,
    });
  } catch (err) {
    if ((err as { code?: string }).code !== '23505') throw err;
    throw new AppError('conflict', 'A content pack exercise in this lesson already has that key');
  }
  return { exercise: await editorRow(pool, row), blockedWords };
}

async function activeItem(db: Queryable, id: number) {
  return (await q.findEditorItem(db, id)) ?? notFound('Item');
}

/**
 * FR-223: replaces an exercise's payload; its type stays. A lesson's exercise, or an item-level
 * one such as a review pin (#241, Product Spec section 11).
 */
export async function updateExercise(
  pool: Pool,
  id: number,
  body: UpdateExerciseRequest,
): Promise<ExerciseWrite> {
  const lessonRow = await q.findLessonExercise(pool, id);
  const row = lessonRow ?? (await q.findItemExercise(pool, id)) ?? notFound('Exercise');
  const owner = lessonRow
    ? await activeLesson(pool, row.lesson_id!)
    : await activeItem(pool, row.item_id!);
  const { payload, blockedWords } = await preparePayload(pool, owner, row.type, body);
  const updated = await q.updateExercisePayload(pool, id, payload);
  return { exercise: await editorRow(pool, updated), blockedWords };
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

/** #241, Product Spec section 11: an item's item-level exercises, such as review pins (FR-229). */
export async function listItemExercises(db: Queryable, itemId: number): Promise<ItemExercises> {
  await activeItem(db, itemId);
  return {
    exercises: await toEditorExercises(await q.listItemExercises(db, itemId), () =>
      itemPinScope(db, itemId),
    ),
  };
}

/** #241: removes an item-level exercise; archived instead when an answer report refers to it. */
export async function deleteItemExercise(
  pool: Pool,
  itemId: number,
  id: number,
): Promise<ItemExercises> {
  await withTransaction(pool, async (db) => {
    await activeItem(db, itemId);
    // Locked, as accepting an answer report locks the exercise it extends.
    const row = await q.findItemExercise(db, id, true);
    if (row?.item_id !== itemId) notFound('Exercise');
    await deleteOrArchive(
      db,
      () => q.deleteExercise(db, id),
      () => q.archiveExercise(db, id),
    );
  });
  return listItemExercises(pool, itemId);
}

/** How many times re-tying asks a generator for each item and facet (#259). */
const RETIE_TRIES = 10;

/** How alike two texts are: the share of their characters they have in common (Jaccard). */
function textLikeness(a: string, b: string): number {
  const [x, y] = [new Set(a), new Set(b)];
  const shared = [...x].filter((c) => y.has(c)).length;
  return shared / (x.size + y.size - shared || 1);
}

/**
 * How close a generated payload is to a pin's, accept lists aside: 1 for each top-level field
 * they share, and for differing text fields (a prompt in new wording) how alike the texts are, so
 * a pin that names no item (a typed meaning) is tied to the exercise about the term it asks.
 */
function closeness(a: JsonObject, b: JsonObject): number {
  return Object.keys(a)
    .filter((k) => k !== 'accept' && Object.hasOwn(b, k))
    .reduce((sum, k) => {
      if (JSON.stringify(a[k]) === JSON.stringify(b[k])) return sum + 1;
      const [x, y] = [a[k], b[k]];
      return typeof x === 'string' && typeof y === 'string' ? sum + textLikeness(x, y) : sum;
    }, 0);
}

/**
 * #259, SDD section 6: ties a pin to an exercise its type's generator makes now, for one of the
 * items it can be about: of those made (for every review facet of the item), the one closest to
 * the pin's payload. Only the recorded original changes; the pin's payload and accept list stay.
 * 409 when the generator makes none. Content rows only; no progress table is touched.
 */
export async function retieExercise(pool: Pool, id: number): Promise<RetieExercise> {
  return withTransaction(pool, async (db) => {
    const row =
      (await q.findLessonExercise(db, id)) ??
      (await q.findItemExercise(db, id, true)) ??
      notFound('Exercise');
    if (row.origin !== 'pinned') {
      throw new AppError('conflict', 'Only a pinned exercise has a generated original');
    }
    if (row.lesson_id !== null) await activeLesson(db, row.lesson_id);
    const scope = await scopeFor(db, row);
    const { plugin, content } = scope;
    const generate = Object.hasOwn(plugin.generators, row.type)
      ? plugin.generators[row.type]!
      : undefined;
    // Generators pick at random (a direction, a form, a sentence), so each is asked several
    // times for the closest to have a fair chance of being among those made.
    const made = pinItems(scope, row.original_payload ?? row.payload).flatMap((item) =>
      [undefined, ...Object.keys(plugin.reviewFacets(item.type))].flatMap((facet) =>
        Array.from({ length: RETIE_TRIES }).flatMap(
          () =>
            generate?.(item, {
              sectionLevel: content.sectionLevel,
              taughtItems: content.items,
              sentences: content.sentences,
              ...(facet ? { facet } : {}),
            }) ?? [],
        ),
      ),
    );
    const candidates = made.flatMap((e) => (isObject(e.payload) ? [e.payload] : []));
    if (candidates.length === 0) {
      throw new AppError('conflict', 'The generators make no exercise of this type here now');
    }
    const best = candidates.reduce((a, b) =>
      closeness(b, row.payload) > closeness(a, row.payload) ? b : a,
    );
    const updated = await q.updateExerciseOriginal(db, id, best);
    return { exercise: toEditorExercise(updated, scope) };
  });
}

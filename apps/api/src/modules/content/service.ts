import type { Pool } from 'pg';
import { ZodError } from 'zod';
import {
  ContentPackError,
  getExerciseType,
  parseItemData,
  UnknownExerciseTypeError,
  UnknownItemTypeError,
} from '@manabi/core';
import type {
  ContentPack,
  LanguagePlugin,
  PackExercise,
  PackItem,
  PackSentence,
  PackTile,
  Tile,
} from '@manabi/core';
import { segmentText } from '@manabi/importers';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { languagePlugins } from '../../plugins';
import { refreshLibraryFields } from '../library/service';
import {
  archiveAuthoredExercisesExcept,
  archiveAuthoredItemsExcept,
  archiveAuthoredSentencesExcept,
  archiveLessonsExcept,
  archiveSectionsExcept,
  archiveUnitsExcept,
  deferPositionChecks,
  findCourseByKey,
  findSentenceId,
  insertPackSentence,
  listActiveItemKeys,
  listAuthoredExercisePayloads,
  listActiveLessons,
  listActiveSections,
  listPackSentences,
  listActiveUnits,
  listBlockedWords,
  listPackItems,
  replaceBlockedWords,
  listSupplementaryWords,
  replaceLessonItems,
  replaceRelatedLinks,
  replaceSentenceItems,
  replaceSupplementaryWords,
  setImportedItemOverrides,
  updatePackSentence,
  upsertAuthoredExercise,
  upsertAuthoredItem,
  upsertCourse,
  upsertLesson,
  upsertSection,
  upsertUnit,
} from './queries';
import type { JsonObject } from './rows';

// Content pack import and export (FR-227, SDD section 4), used by the `manabi pack` CLI and by
// the authoring routes. Import never writes to a progress table (FR-232): rows are upserted by
// stable key so their ids stay put (DR-02, DR-03), and rows dropped from the pack are archived.

function fail(problem: string): never {
  throw new ContentPackError([problem]);
}

/** A pack problem, and the pack object (and field) it is about, for the lint's `file:line`. */
export interface PackProblem {
  message: string;
  at?: object;
  field?: string | number;
}

function duplicates(what: string, entries: [string, object, number?][]): PackProblem[] {
  const seen = new Set<string>();
  return entries
    .filter(([key]) => seen.has(key) || !seen.add(key))
    .map(([key, at, field]) => ({ message: `duplicate ${what} ${key}`, at, field }));
}

/** DR-06: imported data and the data with overrides applied both pass the plugin's schema. */
export function itemDataProblems(
  plugin: LanguagePlugin,
  item: PackItem,
  data: JsonObject,
): string[] {
  try {
    parseItemData(plugin, item.type, data);
    parseItemData(plugin, item.type, { ...data, ...item.overrides });
    return [];
  } catch (err) {
    if (err instanceof UnknownItemTypeError) return [`item ${item.key}: ${err.message}`];
    if (err instanceof ZodError) {
      return err.issues.map((i) => `item ${item.key}: data.${i.path.join('.')}: ${i.message}`);
    }
    throw err;
  }
}

type Issues = ZodError['issues'];
const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A deep copy of a pack payload with each `item: <key>` turned into `itemId: idOf(key)`. */
function resolveItems(value: unknown, idOf: (key: string) => number): unknown {
  if (Array.isArray(value)) return value.map((v) => resolveItems(v, idOf));
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) =>
      k === 'item' && typeof v === 'string' ? ['itemId', idOf(v)] : [k, resolveItems(v, idOf)],
    ),
  );
}

/** The reverse of resolveItems, for export: each `itemId: <id>` becomes `item: keyOf(id)`. */
function itemKeys(value: unknown, keyOf: (id: number) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => itemKeys(v, keyOf));
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) =>
      k === 'itemId' && typeof v === 'number' ? ['item', keyOf(v)] : [k, itemKeys(v, keyOf)],
    ),
  );
}

/** Answer text (`text` with `tiles`) anywhere in a stored payload: its tiles by text. */
function storedTiles(value: unknown, out = new Map<string, Tile[]>()): Map<string, Tile[]> {
  if (Array.isArray(value)) value.forEach((v) => storedTiles(v, out));
  if (!isObject(value)) return out;
  if (typeof value.text === 'string' && Array.isArray(value.tiles))
    out.set(value.text, value.tiles as Tile[]);
  Object.values(value).forEach((v) => storedTiles(v, out));
  return out;
}

/**
 * FR-229, FR-227: accepted answers kept across a re-import. Accepting a report adds answers to an
 * authored exercise's stored `accept` list, marked `source: 'report'`; the pack knows nothing of
 * them. Each marked stored answer whose text the pack's list lacks is appended to
 * `payload.accept` (so none is duplicated) and returned. Unmarked stored answers came from the
 * pack (or an editor edit) and follow the pack: one it no longer lists is dropped (#251). Only a
 * pack list that exists is extended, and only when the exercise keeps its type: answers accepted
 * for a different kind of exercise are dropped with its old payload.
 */
function mergeAcceptedAnswers(
  payload: JsonObject,
  type: string,
  stored: { type: string; payload: JsonObject } | undefined,
): string[] {
  if (stored?.type !== type) return [];
  if (!Array.isArray(payload.accept) || !Array.isArray(stored.payload.accept)) return [];
  const texts = new Set(
    payload.accept.flatMap((a) => (isObject(a) && typeof a.text === 'string' ? [a.text] : [])),
  );
  const kept: string[] = [];
  for (const answer of stored.payload.accept) {
    if (!isObject(answer) || typeof answer.text !== 'string' || answer.source !== 'report')
      continue;
    if (texts.has(answer.text)) continue;
    texts.add(answer.text);
    payload.accept.push(answer);
    kept.push(answer.text);
  }
  return kept;
}

/**
 * A pack exercise's payload in stored form, with items resolved by `idOf`, and the entries of its
 * `accept` list that leave out tiles, for the caller to fill (DR-12, FR-238). Only accept-list
 * answers may: elsewhere (word_bank, reorder) `acceptedOrders` index the tiles the author wrote.
 */
function storedPayload(
  e: PackExercise,
  idOf: (key: string) => number,
): { payload: JsonObject; untiled: { text: string; tiles?: Tile[] }[] } {
  const payload = resolveItems(e.payload, idOf) as JsonObject;
  const accept: unknown[] = Array.isArray(payload.accept) ? payload.accept : [];
  const untiled = accept.filter(
    (a): a is { text: string } =>
      isObject(a) && typeof a.text === 'string' && a.tiles === undefined,
  );
  return { payload, untiled };
}

/** Every object inside `value`, itself included, that `match` accepts. */
export function objectsIn(value: unknown, match: (o: JsonObject) => boolean): JsonObject[] {
  if (Array.isArray(value)) return value.flatMap((v) => objectsIn(v, match));
  if (!isObject(value)) return [];
  return [
    ...(match(value) ? [value] : []),
    ...Object.values(value).flatMap((v) => objectsIn(v, match)),
  ];
}

/** Payload schema issues as problems, at the pack object (and field) each issue path ends at. */
function payloadProblems(label: string, e: PackExercise, issues: Issues): PackProblem[] {
  return issues.map((issue) => {
    // Stored payloads name items by `itemId`; the pack by `item`.
    const path = issue.path.map((k) => (k === 'itemId' ? 'item' : (k as string | number)));
    let at: object = e.payload;
    let field: string | number | undefined;
    for (const k of path) {
      field = k;
      const child: unknown = (at as JsonObject)[k];
      if (typeof child !== 'object' || child === null) break;
      [at, field] = [child, undefined];
    }
    const missingTiles = field === 'tiles' && (at as JsonObject).tiles === undefined;
    const message = missingTiles
      ? 'write the tiles: only accept-list answers are segmented at import, and acceptedOrders index the tiles'
      : issue.message;
    return { message: `${label}: payload.${path.join('.')}: ${message}`, at, field };
  });
}

/** An authored exercise's type and payload problems. Accept-list answers import segments pass. */
function exerciseProblems(lessonKey: string, e: PackExercise): PackProblem[] {
  const label = `lesson ${lessonKey} exercise ${e.key}`;
  // Ids differ between databases, so a pack names items only by key.
  const ids = objectsIn(e.payload, (o) => 'itemId' in o).map((at) => ({
    message: `${label}: name the item by key (item: <key>), not itemId`,
    at,
    field: 'itemId',
  }));
  if (ids.length > 0) return ids;
  try {
    // Item keys are checked at import and by the lint's database checks.
    const { payload, untiled } = storedPayload(e, () => 1);
    for (const answer of untiled)
      answer.tiles = [{ surface: answer.text, base: answer.text, reading: answer.text }];
    const result = getExerciseType(e.type).payloadSchema.safeParse(payload);
    return result.success ? [] : payloadProblems(label, e, result.error.issues);
  } catch (err) {
    if (err instanceof UnknownExerciseTypeError)
      return [{ message: `${label}: ${err.message}`, at: e, field: 'type' }];
    throw err;
  }
}

/**
 * The problems a pack shows without the database: an unknown plugin, duplicate keys, unknown
 * sections and levels, authored item data the plugin rejects, and exercise payloads their type
 * rejects. Shared by importPack and the
 * pack lint (FR-227, FR-228).
 */
export function packProblems(pack: ContentPack): PackProblem[] {
  const { course } = pack;
  if (!languagePlugins.has(course.plugin))
    return [{ message: `course.yaml: plugin: unknown plugin ${course.plugin}` }];
  const plugin = languagePlugins.get(course.plugin);
  const problems = [
    ...duplicates(
      'section',
      course.sections.map((s) => [s.key, s]),
    ),
    ...duplicates(
      'unit',
      pack.units.map((u) => [u.key, u]),
    ),
    ...duplicates(
      'lesson',
      pack.units.flatMap((u) => u.lessons.map((l): [string, object] => [l.key, l])),
    ),
    ...duplicates(
      'exercise',
      pack.units.flatMap((u) =>
        u.lessons.flatMap((l) =>
          l.exercises.map((e): [string, object] => [`${e.key} in lesson ${l.key}`, e]),
        ),
      ),
    ),
    ...duplicates(
      'item',
      pack.items.map((i) => [i.key, i]),
    ),
    // Authored sentences are matched by text, imported ones by source id (findSentenceId).
    ...duplicates(
      'sentence',
      pack.sentences.map((s) => [s.source ? `${s.source}:${s.sourceId}` : s.text, s]),
    ),
    ...duplicates(
      'blocked word',
      pack.blockedWords.map((w, i) => [w, pack.blockedWords, i]),
    ),
    ...duplicates(
      'supplementary word',
      pack.supplementaryWords.map((w) => [`${w.written}:${w.reading}`, w]),
    ),
  ];
  const levels = new Set(course.sections.map((s) => s.level));
  for (const w of pack.supplementaryWords) {
    if (!levels.has(w.level)) {
      const message = `supplementary word ${w.written}:${w.reading}: no section has level ${w.level}`;
      problems.push({ message, at: w, field: 'level' });
    }
  }
  const sections = new Set(course.sections.map((s) => s.key));
  for (const unit of pack.units) {
    if (!sections.has(unit.section)) {
      const message = `unit ${unit.key}: unknown section ${unit.section}`;
      problems.push({ message, at: unit, field: 'section' });
    }
  }
  for (const item of pack.items) {
    if (!item.data) continue;
    for (const message of itemDataProblems(plugin, item, item.data))
      problems.push({ message, at: item, field: 'data' });
  }
  for (const lesson of pack.units.flatMap((u) => u.lessons)) {
    for (const e of lesson.exercises) problems.push(...exerciseProblems(lesson.key, e));
  }
  return problems;
}

/** An answer accepted from a report that a re-import kept although the pack lacks it. */
export interface KeptAnswer {
  lesson: string;
  exercise: string;
  text: string;
}

/** What an import reports besides success. */
export interface ImportSummary {
  /** FR-229: stored report-accepted answers the pack's accept lists lacked, kept on re-import. */
  acceptedAnswersKept: KeptAnswer[];
}

/**
 * Imports a pack in one transaction; nothing is written when any part fails. `structureOnly`
 * stores only the course, sections and lists: the first pass on an empty database, so the
 * dataset imports can find the course and supplementary words before the lessons link their
 * items (SDD section 10).
 */
export async function importPack(
  pool: Pool,
  pack: ContentPack,
  structureOnly = false,
): Promise<ImportSummary> {
  const problems = packProblems(pack);
  if (problems.length > 0) throw new ContentPackError(problems.map((p) => p.message));
  const { course } = pack;
  const plugin = languagePlugins.get(course.plugin);

  const summary: ImportSummary = { acceptedAnswersKept: [] };
  await withTransaction(pool, async (db) => {
    await deferPositionChecks(db);
    const courseId = await upsertCourse(db, course);

    const sectionIds = new Map<string, number>();
    for (const [position, s] of course.sections.entries()) {
      const id = await upsertSection(db, { courseId, position, levelCode: s.level, ...s });
      sectionIds.set(s.key, id ?? fail(`section ${s.key} belongs to another course`));
    }
    await archiveSectionsExcept(db, courseId, [...sectionIds.keys()]);

    // shortcut: the blocklist is per language, so the last imported pack of a language sets it
    // for every course in that language; fine while each language has one course (FR-237).
    await replaceBlockedWords(db, course.targetLang, pack.blockedWords);
    await replaceSupplementaryWords(db, courseId, pack.supplementaryWords);
    if (structureOnly) return;

    // Items first: lessons, links and tiles refer to them.
    for (const item of pack.items) {
      if (item.data) {
        const id = await upsertAuthoredItem(db, {
          courseId,
          levelCode: item.level,
          ...item,
          data: item.data,
        });
        if (id === null)
          fail(`item ${item.key}: key belongs to an imported item or another course`);
      } else {
        const row = await setImportedItemOverrides(db, { courseId, ...item });
        if (!row) fail(`item ${item.key}: no imported ${item.type} item with this key`);
        const dataProblems = itemDataProblems(plugin, item, row.data);
        if (dataProblems.length > 0) throw new ContentPackError(dataProblems);
      }
    }
    await archiveAuthoredItemsExcept(
      db,
      courseId,
      pack.items.filter((i) => i.data).map((i) => i.key),
    );
    await refreshLibraryFields(
      db,
      courseId,
      pack.items.map((i) => i.key),
    );
    const itemIds = new Map((await listActiveItemKeys(db, courseId)).map((r) => [r.key, r.id]));
    const idOf = (key: string, where: string) =>
      itemIds.get(key) ?? fail(`${where}: no active item ${key} in the course`);

    for (const item of pack.items) {
      if (item.related) {
        const ids = item.related.map((key) => idOf(key, `item ${item.key} related`));
        await replaceRelatedLinks(db, idOf(item.key, 'item'), ids);
      }
    }

    const unitsPerSection = new Map<string, number>();
    for (const unit of pack.units) {
      const sectionId =
        sectionIds.get(unit.section) ?? fail(`unit ${unit.key}: unknown section ${unit.section}`);
      const position = unitsPerSection.get(unit.section) ?? 0;
      unitsPerSection.set(unit.section, position + 1);
      const unitId =
        (await upsertUnit(db, { sectionId, position, ...unit })) ??
        fail(`unit ${unit.key} belongs to another course`);
      for (const [lessonPosition, lesson] of unit.lessons.entries()) {
        const lessonId =
          (await upsertLesson(db, { unitId, ...lesson, position: lessonPosition })) ??
          fail(`lesson ${lesson.key} belongs to another course`);
        const ids = lesson.items.map((key) => idOf(key, `lesson ${lesson.key}`));
        await replaceLessonItems(db, lessonId, ids);

        const before = new Map(
          (await listAuthoredExercisePayloads(db, lessonId)).map((r) => [r.key, r]),
        );
        for (const [position, e] of lesson.exercises.entries()) {
          const label = `lesson ${lesson.key} exercise ${e.key}`;
          const { payload, untiled } = storedPayload(e, (key) => idOf(key, label));
          const kept = storedTiles(before.get(e.key)?.payload);
          for (const answer of untiled) {
            // FR-238: tiles stored for the same text are kept, since an author may have edited
            // them; new text is segmented.
            answer.tiles =
              kept.get(answer.text) ??
              (await segmentText(plugin, answer.text)).map(({ counted: _, ...tile }) => tile);
          }
          const merged = mergeAcceptedAnswers(payload, e.type, before.get(e.key));
          const result = getExerciseType(e.type).payloadSchema.safeParse(payload);
          if (!result.success)
            throw new ContentPackError(
              payloadProblems(label, e, result.error.issues).map((p) => p.message),
            );
          summary.acceptedAnswersKept.push(
            ...merged.map((text) => ({ lesson: lesson.key, exercise: e.key, text })),
          );
          await upsertAuthoredExercise(db, {
            lessonId,
            key: e.key,
            position,
            type: e.type,
            payload,
          });
        }
        await archiveAuthoredExercisesExcept(
          db,
          lessonId,
          lesson.exercises.map((e) => e.key),
        );
      }
    }
    await archiveUnitsExcept(
      db,
      courseId,
      pack.units.map((u) => u.key),
    );
    await archiveLessonsExcept(
      db,
      courseId,
      pack.units.flatMap((u) => u.lessons.map((l) => l.key)),
    );

    const sentenceIds: number[] = [];
    for (const s of pack.sentences) {
      const values = {
        ...s,
        tokens: s.tiles.map(({ item, ...tile }): Tile =>
          item === undefined ? tile : { ...tile, itemId: idOf(item, `sentence "${s.text}" tile`) },
        ),
        vocabLevelCode: s.vocabLevel,
        grammarLevelCode: s.grammarLevel,
      };
      const existing = await findSentenceId(db, courseId, s);
      const stored =
        existing === null
          ? await insertPackSentence(db, courseId, values)
          : await updatePackSentence(db, existing, values);
      sentenceIds.push(stored.id);
      const linked = stored.tokens.flatMap((t) => (t.itemId ? [t.itemId] : []));
      await replaceSentenceItems(db, stored.id, linked);
    }
    await archiveAuthoredSentencesExcept(db, courseId, sentenceIds);
  });
  return summary;
}

/** Reads a course's active content back into pack form (the reverse of importPack). */
export async function exportPack(db: Queryable, courseKey: string): Promise<ContentPack> {
  const course = (await findCourseByKey(db, courseKey)) ?? fail(`no course ${courseKey}`);
  const sections = await listActiveSections(db, course.id);
  const units = await listActiveUnits(db, course.id);
  const lessons = await listActiveLessons(db, course.id);
  const items = await listPackItems(db, course.id);
  const sentences = await listPackSentences(db, course.id);
  const supplementaryWords = await listSupplementaryWords(db, course.id);
  const keyOf = new Map((await listActiveItemKeys(db, course.id)).map((r) => [r.id, r.key]));
  const blockedWords = await listBlockedWords(db, course.target_lang);

  return {
    course: {
      key: course.key,
      targetLang: course.target_lang,
      baseLang: course.base_lang,
      plugin: course.plugin,
      title: course.title,
      status: course.status,
      sections: sections.map((s) => ({ key: s.key, title: s.title, level: s.level_code })),
    },
    units: units.map((u) => ({
      key: u.key,
      section: u.section_key,
      title: u.title,
      status: u.status,
      lessons: lessons
        .filter((l) => l.unit_id === u.id)
        .map((l) => ({
          key: l.key,
          type: l.type,
          title: l.title,
          status: l.status,
          items: l.item_keys,
          exercises: l.exercises.map((e) => ({
            ...e,
            payload: itemKeys(
              e.payload,
              (id) => keyOf.get(id) ?? fail(`exercise ${e.key}: item ${id} is archived`),
            ) as JsonObject,
          })),
        })),
    })),
    items: items.map((i) =>
      i.source === null
        ? {
            key: i.key,
            type: i.type,
            level: i.level_code,
            data: i.data,
            overrides: i.overrides,
            related: i.related,
          }
        : { key: i.key, type: i.type, level: null, overrides: i.overrides },
    ),
    sentences: sentences.map((s): PackSentence => ({
      text: s.text,
      translation: s.translation,
      tiles: s.tokens.map(({ itemId, ...tile }): PackTile => {
        if (!itemId) return tile;
        return {
          ...tile,
          item: keyOf.get(itemId) ?? fail(`sentence ${s.id}: tile item ${itemId} is archived`),
        };
      }),
      reviewStatus: s.review_status,
      grammar: s.grammar,
      vocabLevel: s.vocab_level_code,
      grammarLevel: s.grammar_level_code,
      challengeOverride: s.challenge_override,
      source: s.source,
      sourceId: s.source_id,
      attribution: s.attribution,
      edited: s.edited,
      translationEdited: s.translation_edited,
      tokensEdited: s.tokens_edited,
    })),
    blockedWords,
    supplementaryWords: supplementaryWords.map(({ note, ...w }) => (note ? { ...w, note } : w)),
  };
}

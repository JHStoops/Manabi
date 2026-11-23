import type { Pool } from 'pg';
import { ZodError } from 'zod';
import { ContentPackError, parseItemData, UnknownItemTypeError } from '@manabi/core';
import type {
  ContentPack,
  LanguagePlugin,
  PackItem,
  PackSentence,
  PackTile,
  Tile,
} from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { languagePlugins } from '../../plugins';
import {
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

/**
 * The problems a pack shows without the database: an unknown plugin, duplicate keys, unknown
 * sections and levels, and authored item data the plugin rejects. Shared by importPack and the
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
  return problems;
}

/** Imports a pack in one transaction; nothing is written when any part fails. */
export async function importPack(pool: Pool, pack: ContentPack): Promise<void> {
  const problems = packProblems(pack);
  if (problems.length > 0) throw new ContentPackError(problems.map((p) => p.message));
  const { course } = pack;
  const plugin = languagePlugins.get(course.plugin);

  await withTransaction(pool, async (db) => {
    await deferPositionChecks(db);
    const courseId = await upsertCourse(db, course);

    const sectionIds = new Map<string, number>();
    for (const [position, s] of course.sections.entries()) {
      const id = await upsertSection(db, { courseId, position, levelCode: s.level, ...s });
      sectionIds.set(s.key, id ?? fail(`section ${s.key} belongs to another course`));
    }
    await archiveSectionsExcept(db, courseId, [...sectionIds.keys()]);

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

    // shortcut: the blocklist is per language, so the last imported pack of a language sets it
    // for every course in that language; fine while each language has one course (FR-237).
    await replaceBlockedWords(db, course.targetLang, pack.blockedWords);
    await replaceSupplementaryWords(db, courseId, pack.supplementaryWords);
  });
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

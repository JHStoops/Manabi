import { ContentPackError, findBlockedWords } from '@manabi/core';
import type { ContentPack } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { languagePlugins } from '../../plugins';
import { originOf, readPack } from './packFiles';
import { findCourseByKey, findLintItems } from './queries';
import type { JsonObject } from './rows';
import { itemDataProblems, packProblems } from './service';
import type { PackProblem } from './service';

// FR-228 content lint (SDD section 13), run by `manabi pack lint <dir>`. The file checks always
// run. The database checks run only when a database is given: stroke data and the items the
// dataset importers create (KANJIDIC2, JMdict, KanjiVG) exist only there.
// STUB: the taught-so-far rule (FR-048) and blocked words in exercises wait for authored
// exercises in pack files (#169). STUB: uploaded clips do not count yet (#170), so every word and
// sentence needs a reading.

const WORD_TYPE = 'word';

const hasReading = (data: JsonObject) => typeof data.reading === 'string' && data.reading !== '';

/** An item key the pack links to, and where. */
interface Link {
  key: string;
  label: string;
  at: object;
  field: string | number;
}

function format(p: PackProblem): string {
  const origin = p.at && originOf(p.at, p.field);
  return origin ? `${origin}: ${p.message}` : p.message;
}

/** Every problem in the pack at `dir` as `file:line: message`, in check order; empty when clean. */
export async function lintPack(dir: string, db: Queryable | null): Promise<string[]> {
  let pack: ContentPack;
  try {
    pack = await readPack(dir);
  } catch (err) {
    if (err instanceof ContentPackError) return err.problems;
    throw err;
  }
  const problems = packProblems(pack);
  if (!languagePlugins.has(pack.course.plugin)) return problems.map(format);
  const plugin = languagePlugins.get(pack.course.plugin);

  // FR-237: imported sentences with a blocked word are skipped at import; authored ones are reported.
  const blocked = new Set(pack.blockedWords);
  for (const s of pack.sentences) {
    const at = { at: s, field: 'tiles' };
    if (s.source === null) {
      for (const word of findBlockedWords(s.tiles, blocked))
        problems.push({ message: `sentence "${s.text}": blocked word ${word}`, ...at });
    }
    // shortcut: a reading only has to be non-empty, not kana, since no plugin member says what
    // TTS can read; add one if authors put kanji in tile readings.
    if (plugin.readingOf(s.tiles) === '')
      problems.push({ message: `sentence "${s.text}": no reading to generate audio from`, ...at });
  }

  const authored = new Map(pack.items.filter((i) => i.data).map((i) => [i.key, i]));
  for (const item of authored.values()) {
    if (item.type === WORD_TYPE && !hasReading({ ...item.data, ...item.overrides }))
      problems.push({ message: `item ${item.key}: no reading to generate audio from`, at: item });
  }

  const links: Link[] = [];
  for (const lesson of pack.units.flatMap((u) => u.lessons)) {
    const label = `lesson ${lesson.key}`;
    lesson.items.forEach((key, i) => links.push({ key, label, at: lesson.items, field: i }));
  }
  for (const s of pack.sentences) {
    for (const tile of s.tiles) {
      if (tile.item)
        links.push({ key: tile.item, label: `sentence "${s.text}" tile`, at: tile, field: 'item' });
    }
    const label = `sentence "${s.text}" grammar`;
    s.grammar.forEach((key, i) => links.push({ key, label, at: s.grammar, field: i }));
  }
  for (const item of pack.items) {
    const { related } = item;
    const label = `item ${item.key} related`;
    related?.forEach((key, i) => links.push({ key, label, at: related, field: i }));
  }

  if (!db) return problems.map(format);

  const course = await findCourseByKey(db, pack.course.key);
  if (!course) {
    const message = `course ${pack.course.key} is not in the database: import the pack and the datasets first`;
    problems.push({ message, at: pack.course, field: 'key' });
    return problems.map(format);
  }
  const keys = [...new Set([...links.map((l) => l.key), ...pack.items.map((i) => i.key)])];
  const rows = new Map((await findLintItems(db, course.id, keys)).map((r) => [r.key, r]));

  // Items only the database has: links to them must resolve, and overrides need their item.
  const where = new Map<string, { at: object; field?: string | number }>();
  for (const link of links) {
    if (authored.has(link.key)) continue;
    if (!rows.has(link.key))
      problems.push({ message: `${link.label}: no item ${link.key} in the course`, ...link });
    if (!where.has(link.key)) where.set(link.key, { at: link.at, field: link.field });
  }
  const overridden = new Map(pack.items.filter((i) => !i.data).map((i) => [i.key, i]));
  for (const item of overridden.values()) {
    where.set(item.key, { at: item, field: 'overrides' });
    const row = rows.get(item.key);
    if (row?.type !== item.type) {
      const message = `item ${item.key}: no imported ${item.type} item with this key`;
      problems.push({ message, at: item, field: 'key' });
    } else {
      for (const message of itemDataProblems(plugin, item, row.data))
        problems.push({ message, at: item, field: 'overrides' });
    }
  }

  const items: {
    key: string;
    type: string;
    data: JsonObject;
    at?: object;
    field?: string | number;
  }[] = [
    ...[...authored.values()].map((i) => ({ ...i, data: { ...i.data, ...i.overrides }, at: i })),
    ...[...rows.values()]
      .filter((r) => !authored.has(r.key))
      .map((r) => ({
        ...r,
        data: { ...r.data, ...(overridden.get(r.key)?.overrides ?? r.overrides) },
        ...where.get(r.key),
      })),
  ];
  for (const { key, type, data, at, field } of items) {
    // FR-077: a character item is one whose data has a `character`, as the stroke import finds them.
    const { character } = data;
    if (
      plugin.features.strokeDrawing &&
      typeof character === 'string' &&
      !rows.get(key)?.has_strokes
    ) {
      const message = `item ${key}: no stroke data for ${character} (import the pack, then the course's stroke data)`;
      problems.push({ message, at, field });
    }
    if (type === WORD_TYPE && !authored.has(key) && !hasReading(data))
      problems.push({ message: `item ${key}: no reading to generate audio from`, at, field });
  }
  return problems.map(format);
}

import type { Pool } from 'pg';
import { ZodError } from 'zod';
import { itemFields, parseItemData, UnknownItemTypeError } from '@manabi/core';
import type {
  AuthoringItem,
  AuthoringItemSummary,
  CreateItemRequest,
  JsonObject,
  UpdateItemOverridesRequest,
} from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import type { ValidationIssue } from '../../errors';
import { languagePlugins } from '../../plugins';
import { insertItem, replaceRelatedLinks, setItemOverrides } from '../content/queries';
import { findItemIds } from '../imports/queries';
import { refreshGrammarLevelsOf } from './sentencesQueries';
import { refreshLibraryFields } from '../library/service';
import * as q from './itemsQueries';

// FR-221, DR-06, DR-09: the item editor. Author edits go to `items.overrides` only, so the
// dataset importers, which write `data`, never touch them (SDD section 10, import rules).

function view(row: q.AuthoringItemRow): AuthoringItem {
  const plugin = languagePlugins.get(row.plugin);
  const schema = Object.hasOwn(plugin.itemSchemas, row.type)
    ? plugin.itemSchemas[row.type]
    : undefined;
  return {
    id: row.id,
    key: row.key,
    type: row.type,
    levelCode: row.level_code,
    source: row.source,
    datasetVersion: row.dataset_version,
    data: row.data,
    overrides: row.overrides,
    effective: { ...row.data, ...row.overrides },
    fields: schema ? itemFields(schema) : [],
    related: row.related,
  };
}

export async function listItems(
  db: Queryable,
  filter: { course: number; type?: string; q?: string },
): Promise<AuthoringItemSummary[]> {
  const rows = await q.listItems(db, filter.course, filter.type ?? null, filter.q || null);
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    type: r.type,
    levelCode: r.level_code,
    source: r.source,
    overridden: r.overridden,
  }));
}

export async function getItem(db: Queryable, id: number): Promise<AuthoringItem> {
  const row = await q.findItem(db, id);
  if (!row) throw new AppError('not_found', 'Item not found');
  return view(row);
}

/** DR-06: `data` must pass the plugin's item schema for `type`; failures name `path`. */
function validate(plugin: string, type: string, data: JsonObject, path: string): void {
  try {
    parseItemData(languagePlugins.get(plugin), type, data);
  } catch (err) {
    if (err instanceof UnknownItemTypeError) throw new AppError('conflict', err.message);
    if (!(err instanceof ZodError)) throw err;
    const issues: ValidationIssue[] = err.issues.map((i) => ({
      location: 'body',
      path: [path, ...i.path.map((p) => (typeof p === 'number' ? p : String(p)))],
      message: i.message,
    }));
    throw new AppError('validation_failed', 'The item data fails its language schema', issues);
  }
}

/** FR-222: `related` keys to item ids in the course; an unknown key is a validation error. */
async function relatedIds(
  db: Queryable,
  courseId: number,
  self: string,
  related: string[],
): Promise<number[]> {
  const keys = [...new Set(related)];
  if (keys.includes(self)) {
    throw new AppError('validation_failed', 'An item cannot be related to itself', [
      { location: 'body', path: ['related'], message: `${self} is this item` },
    ]);
  }
  const found = new Map((await findItemIds(db, { courseId, keys })).map((r) => [r.key, r.id]));
  const missing = keys.filter((k) => !found.has(k));
  if (missing.length > 0) {
    throw new AppError(
      'validation_failed',
      'Related items not found in this course',
      missing.map((key) => ({ location: 'body', path: ['related'], message: `No item ${key}` })),
    );
  }
  return keys.map((k) => found.get(k)!);
}

/**
 * DR-06: the imported data with these overrides applied must pass the plugin's item schema.
 * FR-222: an authored item's level and related items can change too; an imported item's level
 * belongs to its import.
 */
export async function updateItemOverrides(
  pool: Pool,
  id: number,
  body: UpdateItemOverridesRequest,
): Promise<AuthoringItem> {
  return withTransaction(pool, async (db) => {
    const row = await q.lockItem(db, id);
    if (!row) throw new AppError('not_found', 'Item not found');
    const { overrides, level, related } = body;
    if (row.source !== null && (level !== undefined || related !== undefined)) {
      throw new AppError(
        'conflict',
        "An imported item's level and related items come from its import",
      );
    }
    validate(row.plugin, row.type, { ...row.data, ...overrides }, 'overrides');
    await setItemOverrides(db, row.key, overrides);
    if (level !== undefined && level !== row.level_code) {
      await q.setItemLevel(db, id, level);
      await refreshGrammarLevelsOf(db, row.course_id, row.key);
    }
    if (related !== undefined) {
      await replaceRelatedLinks(db, id, await relatedIds(db, row.course_id, row.key, related));
    }
    await refreshLibraryFields(db, row.course_id, [row.key]);
    return view((await q.findItem(db, id))!);
  });
}

/** FR-222: a new authored item, such as a grammar point. */
export async function createItem(pool: Pool, body: CreateItemRequest): Promise<AuthoringItem> {
  return withTransaction(pool, async (db) => {
    const plugin = await q.findCoursePlugin(db, body.course);
    if (!plugin) throw new AppError('not_found', 'Course not found');
    validate(plugin, body.type, body.data, 'data');
    let id: number;
    try {
      ({ id } = await insertItem(db, {
        courseId: body.course,
        key: body.key,
        type: body.type,
        levelCode: body.level,
        data: body.data,
        source: null,
        datasetVersion: null,
      }));
    } catch (err) {
      if ((err as { code?: string }).code !== '23505') throw err;
      throw new AppError('conflict', 'An item with that key already exists');
    }
    await refreshLibraryFields(db, body.course, [body.key]);
    return view((await q.findItem(db, id))!);
  });
}

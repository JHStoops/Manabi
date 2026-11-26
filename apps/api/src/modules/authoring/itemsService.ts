import type { Pool } from 'pg';
import { ZodError } from 'zod';
import { itemFields, parseItemData, UnknownItemTypeError } from '@manabi/core';
import type { AuthoringItem, AuthoringItemSummary, JsonObject } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import type { ValidationIssue } from '../../errors';
import { languagePlugins } from '../../plugins';
import { setItemOverrides } from '../content/queries';
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

/** DR-06: the imported data with these overrides applied must pass the plugin's item schema. */
export async function updateItemOverrides(
  pool: Pool,
  id: number,
  overrides: JsonObject,
): Promise<AuthoringItem> {
  return withTransaction(pool, async (db) => {
    const row = await q.lockItem(db, id);
    if (!row) throw new AppError('not_found', 'Item not found');
    try {
      parseItemData(languagePlugins.get(row.plugin), row.type, { ...row.data, ...overrides });
    } catch (err) {
      if (err instanceof UnknownItemTypeError) throw new AppError('conflict', err.message);
      if (!(err instanceof ZodError)) throw err;
      const issues: ValidationIssue[] = err.issues.map((i) => ({
        location: 'body',
        path: ['overrides', ...i.path.map((p) => (typeof p === 'number' ? p : String(p)))],
        message: i.message,
      }));
      throw new AppError('validation_failed', 'The item data fails its language schema', issues);
    }
    await setItemOverrides(db, row.key, overrides);
    return view({ ...row, overrides });
  });
}

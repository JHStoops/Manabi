import type { StrokeData } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { queryOne } from '../../db/db';

/** FR-077: the stored Hanzi Writer stroke data of the item with this key, or null. */
export async function findStrokeData(db: Queryable, itemKey: string): Promise<StrokeData | null> {
  const row = await queryOne<{ strokes: StrokeData }>(
    db,
    `SELECT s.strokes FROM stroke_data s JOIN items i ON i.id = s.item_id WHERE i.key = $1`,
    [itemKey],
  );
  return row?.strokes ?? null;
}

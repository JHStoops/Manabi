import type { StrokeData } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { AppError } from '../../errors';
import * as q from './queries';

/** FR-071, FR-077: a character's stroke data for the stroke canvas; 404 when it has none. */
export async function getStrokes(db: Queryable, itemKey: string): Promise<StrokeData> {
  const strokes = await q.findStrokeData(db, itemKey);
  if (!strokes) throw new AppError('not_found', 'No stroke data for this item');
  return strokes;
}

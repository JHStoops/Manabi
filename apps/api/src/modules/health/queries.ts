import type { Queryable } from '../../db/db';
import { queryOne } from '../../db/db';

/** FR-203: the cheapest round trip that proves the database answers. */
export async function pingDatabase(db: Queryable): Promise<boolean> {
  const row = await queryOne<{ ok: number }>(db, 'SELECT 1 AS ok');
  return row?.ok === 1;
}

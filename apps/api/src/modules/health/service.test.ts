import type { Queryable } from '../../db/db';
import { checkHealth } from './service';

// FR-203
describe('checkHealth', () => {
  it('reports the database ok when it answers', async () => {
    const db: Queryable = { query: jest.fn().mockResolvedValue({ rows: [{ ok: 1 }] }) };
    await expect(checkHealth(db)).resolves.toEqual({ api: 'ok', database: 'ok' });
  });

  it('reports the database unavailable when the query fails', async () => {
    const db: Queryable = { query: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    await expect(checkHealth(db)).resolves.toEqual({ api: 'ok', database: 'unavailable' });
  });

  it('reports the database unavailable when it does not answer in time', async () => {
    const db: Queryable = { query: jest.fn(() => new Promise(() => {})) as Queryable['query'] };
    await expect(checkHealth(db, 10)).resolves.toEqual({ api: 'ok', database: 'unavailable' });
  });
});

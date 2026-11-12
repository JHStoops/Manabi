import { query, queryOne, withTransaction } from './db';
import { createPool } from './pool';
import { describeWithDb, useTestDatabase } from '../test/db';

describe('createPool', () => {
  it('requires a database URL', () => {
    expect(() => createPool('')).toThrow('DATABASE_URL is not set');
  });

  it('logs idle client errors instead of crashing the process', async () => {
    const logError = jest.fn();
    const pool = createPool('postgres://unused@localhost/none', logError);
    const err = new Error('terminating connection due to administrator command');
    expect(() => pool.emit('error', err)).not.toThrow();
    expect(logError).toHaveBeenCalledWith('Idle database client error', err);
    await pool.end();
  });
});

describeWithDb('db helpers', () => {
  const pool = useTestDatabase();

  const countCourses = async (): Promise<number> => {
    const row = await queryOne<{ n: number }>(pool(), 'SELECT count(*) AS n FROM courses');
    return row!.n;
  };

  const insertCourseSql = `INSERT INTO courses (key, target_lang, base_lang, plugin, title)
    VALUES ($1, 'ja', 'en', 'ja', 'Japanese') RETURNING id`;

  it('runs parameterized queries and returns typed rows, with int8 as number', async () => {
    const rows = await query<{ id: number }>(pool(), insertCourseSql, ['ja-en']);
    expect(rows).toEqual([{ id: 1 }]);
    expect(await countCourses()).toBe(1);
    expect(await queryOne(pool(), 'SELECT 1 WHERE false')).toBeNull();
  });

  it('commits a transaction when the callback resolves', async () => {
    const result = await withTransaction(pool(), async (client) => {
      await query(client, insertCourseSql, ['a']);
      await query(client, insertCourseSql, ['b']);
      return 'done';
    });
    expect(result).toBe('done');
    expect(await countCourses()).toBe(2);
  });

  it('rolls back every statement when the callback throws', async () => {
    await expect(
      withTransaction(pool(), async (client) => {
        await query(client, insertCourseSql, ['a']);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await countCourses()).toBe(0);
  });

  it('rolls back when a statement fails and returns a usable client to the pool', async () => {
    await expect(
      withTransaction(pool(), async (client) => {
        await query(client, insertCourseSql, ['a']);
        await query(client, insertCourseSql, ['a']); // duplicate key
      }),
    ).rejects.toThrow(/duplicate key/);
    expect(await countCourses()).toBe(0);
    // The pool still works after the failed transaction.
    await withTransaction(pool(), (client) => query(client, insertCourseSql, ['b']));
    expect(await countCourses()).toBe(1);
  });

  it('returns date columns as YYYY-MM-DD strings, not Dates', async () => {
    const row = await queryOne<{ d: string }>(pool(), `SELECT '2026-11-09'::date AS d`);
    expect(row).toEqual({ d: '2026-11-09' });
  });

  it('rejects int8 values outside the safe integer range', async () => {
    await expect(queryOne(pool(), 'SELECT 9007199254740993::bigint AS n')).rejects.toThrow(
      RangeError,
    );
  });
});

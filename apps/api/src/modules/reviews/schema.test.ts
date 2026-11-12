import type { Pool } from 'pg';
import { query, withTransaction } from '../../db/db';
import { describeWithDb, truncateAll, useTestDatabase } from '../../test/db';
import { seedCourse, seedItems, seedUser, ARGON2ID_HASH } from '../../test/fixtures';
import { setItemOverrides } from '../content/queries';
import type { NewReviewLog } from './queries';
import { DUE_FACETS_SQL, insertItemProgress, insertReviewLog, listDueFacets } from './queries';

// Integration tests for migration 0003: item progress and the review log. Raw SQL here
// exercises constraints directly; application code keeps its SQL in queries.ts files.

const HOUR = 3_600_000;

async function seedLearnerWithItems(pool: Pool, count: number) {
  const courseId = await seedCourse(pool);
  const itemIds = await seedItems(pool, courseId, count);
  const user = await seedUser(pool);
  return { courseId, itemIds, userId: user.id };
}

function answer(userId: number, itemId: number): NewReviewLog {
  return {
    userId,
    itemId,
    facet: 'reading',
    exerciseType: 'reading_type',
    correct: false,
    stageBefore: 5,
    stageAfter: 3,
  };
}

interface PlanNode {
  'Node Type': string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

function indexesUsed(node: PlanNode): string[] {
  const own = node['Index Name'] ? [node['Index Name']] : [];
  return [...own, ...(node.Plans ?? []).flatMap(indexesUsed)];
}

describeWithDb('review schema (migration 0003)', () => {
  const pool = useTestDatabase();

  describe('item_progress', () => {
    it('lists due facets oldest first and skips future and retired ones', async () => {
      const { itemIds, userId } = await seedLearnerWithItems(pool(), 4);
      const now = new Date('2026-11-11T12:00:00Z');
      const at = (hours: number) => new Date(now.getTime() + hours * HOUR);
      await insertItemProgress(pool(), {
        userId,
        itemId: itemIds[0]!,
        facet: 'meaning',
        stage: 2,
        dueAt: at(-1),
      });
      await insertItemProgress(pool(), {
        userId,
        itemId: itemIds[1]!,
        facet: 'reading',
        stage: 1,
        dueAt: at(-5),
      });
      await insertItemProgress(pool(), {
        userId,
        itemId: itemIds[2]!,
        facet: 'meaning',
        stage: 3,
        dueAt: at(2),
      });
      await insertItemProgress(pool(), {
        userId,
        itemId: itemIds[3]!,
        facet: 'meaning',
        stage: 8,
        dueAt: null,
      });

      const due = await listDueFacets(pool(), userId, now, 20);
      expect(due.map((r) => [r.item_id, r.facet])).toEqual([
        [itemIds[1], 'reading'],
        [itemIds[0], 'meaning'],
      ]);
      expect(await listDueFacets(pool(), userId, now, 1)).toHaveLength(1);
    });

    it('keeps one row per item and facet, with stages 1 to 8', async () => {
      const { itemIds, userId } = await seedLearnerWithItems(pool(), 1);
      const itemId = itemIds[0]!;
      await insertItemProgress(pool(), {
        userId,
        itemId,
        facet: 'meaning',
        stage: 1,
        dueAt: new Date(),
      });
      await insertItemProgress(pool(), {
        userId,
        itemId,
        facet: 'reading',
        stage: 1,
        dueAt: new Date(),
      });
      await expect(
        insertItemProgress(pool(), {
          userId,
          itemId,
          facet: 'meaning',
          stage: 2,
          dueAt: new Date(),
        }),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        insertItemProgress(pool(), {
          userId,
          itemId,
          facet: 'listening',
          stage: 9 as never,
          dueAt: new Date(),
        }),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        insertItemProgress(pool(), {
          userId,
          itemId,
          facet: 'Bad Facet',
          stage: 1,
          dueAt: new Date(),
        }),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('has a due time exactly when the item is not retired (stage 8)', async () => {
      const { itemIds, userId } = await seedLearnerWithItems(pool(), 1);
      const itemId = itemIds[0]!;
      await expect(
        insertItemProgress(pool(), {
          userId,
          itemId,
          facet: 'meaning',
          stage: 8,
          dueAt: new Date(),
        }),
      ).rejects.toMatchObject({ constraint: 'item_progress_due_unless_retired' });
      await expect(
        insertItemProgress(pool(), { userId, itemId, facet: 'meaning', stage: 3, dueAt: null }),
      ).rejects.toMatchObject({ constraint: 'item_progress_due_unless_retired' });
    });

    it('answers the due query from the (user_id, due_at) index (SDD section 7)', async () => {
      // A realistic spread so the planner chooses the index on its own: 50 learners (NFR-06)
      // with 200 item facets each, then fresh statistics. With a handful of rows PostgreSQL
      // would rightly prefer a sequential scan, so the table is filled first; enable_seqscan
      // is left on, so this shows the planner picks the index for the real query shape.
      const courseId = await seedCourse(pool());
      await seedItems(pool(), courseId, 200);
      await query(
        pool(),
        `INSERT INTO users (username, password_hash, display_name, time_zone)
         SELECT 'u' || n, $1, 'U' || n, 'UTC' FROM generate_series(1, 50) AS n`,
        [ARGON2ID_HASH],
      );
      await query(
        pool(),
        `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
         SELECT u.id, i.id, 'meaning', 2, now() + (i.id % 14 - 7) * interval '1 day'
           FROM users u CROSS JOIN items i`,
      );
      await query(pool(), 'ANALYZE item_progress');

      const userId = (await query<{ id: number }>(pool(), `SELECT min(id) AS id FROM users`))[0]!
        .id;
      const [row] = await query<{ 'QUERY PLAN': [{ Plan: PlanNode }] }>(
        pool(),
        `EXPLAIN (FORMAT JSON) ${DUE_FACETS_SQL}`,
        [userId, new Date(), 20],
      );
      const plan = row!['QUERY PLAN'][0].Plan;
      expect(indexesUsed(plan)).toContain('item_progress_user_due_idx');
    });
  });

  describe('review_log (DR-04, FR-117)', () => {
    it('appends answers', async () => {
      const { itemIds, userId } = await seedLearnerWithItems(pool(), 1);
      const row = await insertReviewLog(pool(), answer(userId, itemIds[0]!));
      expect(row).toMatchObject({
        user_id: userId,
        correct: false,
        stage_before: 5,
        stage_after: 3,
      });
      expect(row.answered_at).toBeInstanceOf(Date);
    });

    it('rejects UPDATE', async () => {
      const { itemIds, userId } = await seedLearnerWithItems(pool(), 1);
      const row = await insertReviewLog(pool(), answer(userId, itemIds[0]!));
      await expect(
        query(pool(), `UPDATE review_log SET correct = true WHERE id = $1`, [row.id]),
      ).rejects.toMatchObject({
        code: '23001',
        message: 'review_log is append-only: UPDATE is not allowed',
      });
    });

    it('rejects DELETE while the learner exists', async () => {
      const { itemIds, userId } = await seedLearnerWithItems(pool(), 1);
      await insertReviewLog(pool(), answer(userId, itemIds[0]!));
      await expect(
        query(pool(), `DELETE FROM review_log WHERE user_id = $1`, [userId]),
      ).rejects.toMatchObject({
        code: '23001',
        message: 'review_log is append-only: DELETE is not allowed',
      });
      expect(await query(pool(), `SELECT 1 FROM review_log`)).toHaveLength(1);
    });

    it('rejects TRUNCATE unless the transaction allows it, as the test harness does', async () => {
      const { itemIds, userId } = await seedLearnerWithItems(pool(), 1);
      await insertReviewLog(pool(), answer(userId, itemIds[0]!));
      await expect(query(pool(), `TRUNCATE review_log`)).rejects.toMatchObject({
        code: '23001',
        message: 'review_log is append-only: TRUNCATE is not allowed',
      });
      // TRUNCATE of a parent table cascades to the log and is rejected too.
      await expect(query(pool(), `TRUNCATE users CASCADE`)).rejects.toMatchObject({
        code: '23001',
      });
      // The setting is transaction-local: it does not leak to later statements.
      await withTransaction(pool(), async (client) => {
        await client.query(
          `SELECT set_config('manabi.allow_truncate', pg_current_xact_id()::text, true)`,
        );
        await client.query(`TRUNCATE review_log`);
      });
      await expect(query(pool(), `TRUNCATE review_log`)).rejects.toMatchObject({ code: '23001' });
      await insertReviewLog(pool(), answer(userId, itemIds[0]!));
      await truncateAll(pool());
      expect(await query(pool(), `SELECT 1 FROM review_log`)).toHaveLength(0);
    });

    it('ignores a session-level or stale truncate setting', async () => {
      const { itemIds, userId } = await seedLearnerWithItems(pool(), 1);
      await insertReviewLog(pool(), answer(userId, itemIds[0]!));
      const client = await pool().connect();
      try {
        // A plain 'on', even set for the whole session, does not allow TRUNCATE.
        await client.query(`SET manabi.allow_truncate = 'on'`);
        await expect(client.query(`TRUNCATE review_log`)).rejects.toMatchObject({
          code: '23001',
        });
        // Nor does the id of an earlier transaction, kept at session level.
        await client.query('BEGIN');
        await client.query(
          `SELECT set_config('manabi.allow_truncate', pg_current_xact_id()::text, false)`,
        );
        await client.query('COMMIT');
        await expect(client.query(`TRUNCATE review_log`)).rejects.toMatchObject({
          code: '23001',
        });
      } finally {
        await client.query('RESET manabi.allow_truncate');
        client.release();
      }
      expect(await query(pool(), `SELECT 1 FROM review_log`)).toHaveLength(1);
    });

    it('checks facet, exercise type and stages', async () => {
      const { itemIds, userId } = await seedLearnerWithItems(pool(), 1);
      const base = answer(userId, itemIds[0]!);
      for (const bad of [
        { facet: '' },
        { exerciseType: 'Reading Type' },
        { stageBefore: 0 as never },
        { stageAfter: 9 as never },
      ]) {
        await expect(insertReviewLog(pool(), { ...base, ...bad })).rejects.toMatchObject({
          code: '23514',
        });
      }
    });
  });

  describe('progress and content edits (DR-03, FR-232)', () => {
    it('survives item edits and blocks deleting an item that has progress', async () => {
      const { itemIds, userId } = await seedLearnerWithItems(pool(), 1);
      const itemId = itemIds[0]!;
      await insertItemProgress(pool(), {
        userId,
        itemId,
        facet: 'meaning',
        stage: 4,
        dueAt: new Date(),
      });
      await insertReviewLog(pool(), answer(userId, itemId));
      await query(
        pool(),
        `INSERT INTO user_notes (user_id, item_id, body) VALUES ($1, $2, 'mnemonic')`,
        [userId, itemId],
      );

      // Re-import and author edits update the item in place; archiving keeps the row.
      await setItemOverrides(pool(), 'ja:word:1', { meanings: ['edited'] });
      await query(
        pool(),
        `UPDATE items SET data = '{"reading":"x"}', archived_at = now() WHERE id = $1`,
        [itemId],
      );
      expect(
        await query(pool(), `SELECT stage FROM item_progress WHERE item_id = $1`, [itemId]),
      ).toEqual([{ stage: 4 }]);

      await expect(
        query(pool(), `DELETE FROM items WHERE id = $1`, [itemId]),
      ).rejects.toMatchObject({
        code: '23503',
      });
    });
  });
});

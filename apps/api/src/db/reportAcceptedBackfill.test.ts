import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { query, queryOne } from '../db/db';
import { readPack } from '../modules/content/packFiles';
import { importPack } from '../modules/content/service';
import { describeWithDb, useTestDatabase } from '../test/db';

// #251, FR-229: migration 0013 marks answers accepted from reports before the `source` marker
// existed. The migration has already run on the test database; its UPDATE is idempotent, so it
// is run again here on rows seeded the old way.

const MIGRATION = join(__dirname, '../../migrations/0013_report_accepted_answers.sql');
const FIXTURE = join(__dirname, '../test/fixtures/ja-en');

describeWithDb('migration 0013 (report-accepted answers)', () => {
  const pool = useTestDatabase();

  it('marks stored answers that an accepted report added, and nothing else', async () => {
    await importPack(pool(), await readPack(FIXTURE));
    const { id } = (await queryOne<{ id: number }>(
      pool(),
      `SELECT id FROM exercises WHERE key = 'type-water'`,
    ))!;
    // Before #251: accepting a report appended an unmarked answer.
    await query(
      pool(),
      `UPDATE exercises
          SET payload = jsonb_set(payload, '{accept}', payload->'accept' || $2::jsonb)
        WHERE id = $1`,
      [
        id,
        JSON.stringify([
          { text: 'みず', tiles: [] },
          { text: 'おみず', tiles: [] },
        ]),
      ],
    );
    const report = `INSERT INTO answer_reports
        (exercise_id, exercise_type, exercise_payload, given_answer, status, resolved_at)
      VALUES ($1, 'typed_answer', '{}', $2, $3, CASE WHEN $3 = 'open' THEN NULL ELSE now() END)`;
    await query(pool(), report, [id, 'みず', 'accepted']);
    // A dismissed or still open report of an answer the author typed in does not mark it.
    await query(pool(), report, [id, 'おみず', 'dismissed']);
    await query(pool(), report, [id, 'おみず', 'open']);

    const sql = await readFile(MIGRATION, 'utf8');
    await query(pool(), sql);
    await query(pool(), sql);

    const row = await queryOne<{ payload: { accept: object[] } }>(
      pool(),
      'SELECT payload FROM exercises WHERE id = $1',
      [id],
    );
    expect(row!.payload.accept).toEqual([
      expect.not.objectContaining({ source: expect.anything() }),
      { text: 'みず', tiles: [], source: 'report' },
      { text: 'おみず', tiles: [] },
    ]);
    expect((row!.payload.accept[0] as { text: string }).text).toBe('水');
  });
});

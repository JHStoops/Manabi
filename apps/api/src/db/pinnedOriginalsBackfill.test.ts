import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { query } from '../db/db';
import { describeWithDb, useTestDatabase } from '../test/db';

// #254, FR-229: migration 0014 records each existing pin's generated original. The migration has
// already run on the test database; its backfill UPDATE (idempotent) is run again here on pins
// seeded without one, as they were before the column existed.

const MIGRATION = join(__dirname, '../../migrations/0014_pinned_originals.sql');

describeWithDb('migration 0014 (pinned originals)', () => {
  const pool = useTestDatabase();
  const sql = <R extends object = { id: number }>(text: string, params: unknown[] = []) =>
    query<R>(pool(), text, params);

  it("fills a pin's original from its first report, else from its own payload", async () => {
    const [course] = await sql(
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('ja-en', 'ja', 'en', 'ja', 'Japanese', 'published') RETURNING id`,
    );
    const [item] = await sql(
      `INSERT INTO items (course_id, key, type, level_code)
       VALUES ($1, 'ja:word:mizu', 'word', 'N5') RETURNING id`,
      [course!.id],
    );
    const exercise = (origin: string, payload: object) =>
      sql(
        `INSERT INTO exercises (item_id, type, payload, origin)
         VALUES ($1, 'typed_answer', $2, $3) RETURNING id`,
        [item!.id, payload, origin],
      );
    const accept = (...texts: string[]) => texts.map((text) => ({ text, tiles: [] }));
    // A pin whose prompt an author edited after a report pinned it.
    const [edited] = await exercise('pinned', {
      prompt: 'Edited',
      accept: accept('water', 'aqua'),
    });
    // A pin with no report (pinned in the lesson editor).
    const [plain] = await exercise('pinned', { prompt: 'Plain', accept: accept('water') });
    const [authored] = await exercise('authored', { prompt: 'Authored', accept: accept('a') });
    const report = `INSERT INTO answer_reports
        (exercise_id, exercise_type, exercise_payload, given_answer, status, resolved_at)
      VALUES ($1, 'typed_answer', $2, $3, 'accepted', now())`;
    await sql(report, [edited!.id, { prompt: 'Original', accept: accept('water') }, 'aqua']);
    await sql(report, [edited!.id, { prompt: 'Edited', accept: accept('water', 'aqua') }, 'x']);

    const text = await readFile(MIGRATION, 'utf8');
    const backfill = text.slice(text.indexOf('UPDATE exercises'));
    await sql(`UPDATE exercises SET original_payload = NULL`);
    await sql(backfill);
    await sql(backfill);

    expect(
      await sql<{ id: number; original_payload: unknown }>(
        `SELECT id, original_payload FROM exercises ORDER BY id`,
      ),
    ).toEqual([
      { id: edited!.id, original_payload: { prompt: 'Original' } },
      { id: plain!.id, original_payload: { prompt: 'Plain' } },
      { id: authored!.id, original_payload: null },
    ]);
  });

  it('allows an original only on a pin', async () => {
    await expect(
      sql(
        `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
         VALUES ('ja-en', 'ja', 'en', 'ja', 'Japanese', 'published');
         INSERT INTO items (course_id, key, type, level_code)
         VALUES ((SELECT id FROM courses), 'ja:word:mizu', 'word', 'N5');
         INSERT INTO exercises (item_id, type, payload, origin, original_payload)
         VALUES ((SELECT id FROM items), 'typed_answer', '{}', 'authored', '{}')`,
      ),
    ).rejects.toThrow(/exercises_original_payload_only_pins/);
  });
});

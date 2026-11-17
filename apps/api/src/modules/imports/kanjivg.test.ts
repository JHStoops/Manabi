import { join } from 'node:path';
import { query } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse } from '../../test/fixtures';
import { findItemByKey } from '../content/queries';
import { importKanjidic2, importKanjiVg } from './service';

const FIXTURES = join(__dirname, '../../../../../packages/importers/fixtures');
const KANJIDIC2 = join(FIXTURES, 'kanjidic2.xml');
const KANJIVG = join(FIXTURES, 'kanjivg.xml');

describeWithDb('importKanjiVg (FR-226, FR-077, NFR-62)', () => {
  const pool = useTestDatabase();

  const strokeData = () =>
    query<{ key: string; type: string; strokes: { strokes: string[]; medians: unknown[] } }>(
      pool(),
      `SELECT i.key, i.type, s.strokes FROM items i
       LEFT JOIN stroke_data s ON s.item_id = i.id
       WHERE i.type IN ('kanji', 'kana') ORDER BY i.id`,
    );

  it('creates kana items and stores strokes for every character, then re-runs as a no-op', async () => {
    await seedCourse(pool());
    await importKanjidic2(pool(), { courseKey: 'ja-en', file: KANJIDIC2 });
    const first = await importKanjiVg(pool(), { courseKey: 'ja-en', file: KANJIVG });
    const second = await importKanjiVg(pool(), { courseKey: 'ja-en', file: KANJIVG });

    const run = {
      datasetVersion: '2026-07-14',
      licence: 'CC BY-SA 3.0',
      attribution: expect.stringContaining('KanjiVG'),
      // The fixture has only あ among the kana.
      missing: expect.arrayContaining(['い', 'ア', 'ン']),
    };
    // 142 kana items, and stroke rows for 水, 逢 and あ.
    expect(first).toEqual({
      ...run,
      ...{ added: 142, updated: 0, skipped: 0, skippedOwned: [] },
      ...{ strokesAdded: 3, strokesUpdated: 0, strokesSkipped: 0 },
    });
    expect(second).toEqual({
      ...run,
      ...{ added: 0, updated: 0, skipped: 142, skippedOwned: [] },
      ...{ strokesAdded: 0, strokesUpdated: 0, strokesSkipped: 3 },
    });
    expect(first.missing).toHaveLength(141);
    expect(first.missing).not.toContain('あ');

    const [runs] = await query<{ statuses: string[] }>(
      pool(),
      `SELECT array_agg(status ORDER BY id) AS statuses FROM import_runs WHERE importer = 'kanjivg'`,
    );
    expect(runs!.statuses).toEqual(['succeeded', 'succeeded']);

    const rows = await strokeData();
    const kanji = rows.filter((r) => r.type === 'kanji');
    expect(kanji.map((r) => r.key)).toEqual(['ja:kanji:水', 'ja:kanji:逢']);
    for (const { strokes } of kanji) {
      expect(strokes.strokes.length).toBeGreaterThan(0);
      expect(strokes.medians).toHaveLength(strokes.strokes.length);
    }
    expect(rows.find((r) => r.key === 'ja:kana:あ')!.strokes.strokes).toHaveLength(3);
    expect(await findItemByKey(pool(), 'ja:kana:ン')).toMatchObject({
      type: 'kana',
      source: 'kanjivg',
      data: { character: 'ン', script: 'katakana', romaji: 'n' },
    });
  });
});

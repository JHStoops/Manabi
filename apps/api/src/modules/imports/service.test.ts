import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { query } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse } from '../../test/fixtures';
import { findItemByKey, setItemOverrides } from '../content/queries';
import { importKanjidic2 } from './service';

const FIXTURE = join(__dirname, '../../../../../packages/importers/fixtures/kanjidic2.xml');

describeWithDb('importKanjidic2 (FR-226, DR-09, NFR-62)', () => {
  const pool = useTestDatabase();

  const runs = () =>
    query<{ importer: string; status: string; summary: Record<string, unknown> }>(
      pool(),
      `SELECT importer, status, summary FROM import_runs ORDER BY id`,
    );

  it('adds items, then a second run of the same file updates nothing and counts skips', async () => {
    await seedCourse(pool());
    const first = await importKanjidic2(pool(), { courseKey: 'ja-en', file: FIXTURE });
    const second = await importKanjidic2(pool(), { courseKey: 'ja-en', file: FIXTURE });

    const run = {
      datasetVersion: '2026-11-12',
      licence: 'CC BY-SA 4.0',
      attribution: expect.stringContaining('EDRDG'),
    };
    expect(first).toEqual({ ...run, added: 2, updated: 0, skipped: 0, skippedOwned: [] });
    expect(second).toEqual({ ...run, added: 0, updated: 0, skipped: 2, skippedOwned: [] });
    expect(await runs()).toEqual([
      { importer: 'kanjidic2', status: 'succeeded', summary: first },
      { importer: 'kanjidic2', status: 'succeeded', summary: second },
    ]);

    const water = await findItemByKey(pool(), 'ja:kanji:水');
    expect(water).toMatchObject({
      type: 'kanji',
      source: 'kanjidic2',
      dataset_version: '2026-11-12',
      overrides: {},
      data: { character: '水', meanings: ['water'], strokeCount: 4, components: ['水'] },
    });
  });

  it('keeps author overrides when an item is re-imported with new data', async () => {
    await seedCourse(pool());
    await importKanjidic2(pool(), { courseKey: 'ja-en', file: FIXTURE });
    await setItemOverrides(pool(), 'ja:kanji:逢', { meanings: ['meet'] });

    const dir = await mkdtemp(join(tmpdir(), 'kanjidic2-'));
    try {
      const file = join(dir, 'kanjidic2.xml');
      const xml = await readFile(FIXTURE, 'utf8');
      await writeFile(
        file,
        xml.replace('<meaning>tryst</meaning>', '<meaning>tryst</meaning><meaning>date</meaning>'),
      );
      const summary = await importKanjidic2(pool(), { courseKey: 'ja-en', file });
      expect(summary).toMatchObject({ added: 0, updated: 1, skipped: 1 });
    } finally {
      await rm(dir, { recursive: true });
    }

    expect(await findItemByKey(pool(), 'ja:kanji:逢')).toMatchObject({
      data: { meanings: ['meeting', 'tryst', 'date'] },
      overrides: { meanings: ['meet'] },
    });
  });

  it('records a failed run when the course does not exist', async () => {
    await expect(importKanjidic2(pool(), { courseKey: 'ja-en', file: FIXTURE })).rejects.toThrow(
      /No course ja-en/,
    );
    expect(await runs()).toEqual([
      { importer: 'kanjidic2', status: 'failed', summary: { error: expect.any(String) } },
    ]);
  });
});

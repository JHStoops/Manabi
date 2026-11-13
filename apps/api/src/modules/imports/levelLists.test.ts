import http from 'node:http';
import https from 'node:https';
import { join } from 'node:path';
import { query } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse } from '../../test/fixtures';
import { findItemByKey, insertItem, setItemOverrides } from '../content/queries';
import { importKanjidic2, importLevelLists } from './service';

const FIXTURES = join(__dirname, '../../../../../packages/importers/fixtures');
const dir = join(FIXTURES, 'tanos');

describeWithDb('importLevelLists (FR-226, FR-233, FR-244, NFR-62)', () => {
  const pool = useTestDatabase();

  const levelOf = async (key: string) => (await findItemByKey(pool(), key))?.level_code;
  const words = () =>
    query<{ level_code: string; written: string; reading: string }>(
      pool(),
      `SELECT level_code, written, reading FROM level_list_words ORDER BY level_code DESC, written`,
    );

  async function seed() {
    const courseId = await seedCourse(pool());
    await importKanjidic2(pool(), {
      courseKey: 'ja-en',
      file: join(FIXTURES, 'kanjidic2.xml'),
    });
    return courseId;
  }

  it('skips levels above the ceiling, adds them when it is raised, and is idempotent', async () => {
    await seed();
    const run = {
      datasetVersion: '2010-11-21',
      licence: 'CC BY',
      attribution: 'JLPT Resources by Jonathan Waller (tanos.co.uk)',
    };

    const n3 = await importLevelLists(pool(), { courseKey: 'ja-en', ceiling: 'N3', dir });
    // 水 is set; 日 has no kanji item yet, so it is skipped along with the N4 repeat of 水.
    expect(n3).toEqual({
      ...run,
      ceiling: 'N3',
      levels: ['N5', 'N4'],
      added: 3,
      updated: 1,
      skipped: 1,
    });
    expect(await levelOf('ja:kanji:水')).toBe('N5');
    expect(await levelOf('ja:kanji:逢')).toBeNull();
    expect(await words()).toEqual([
      { level_code: 'N5', written: 'あさって', reading: 'あさって' },
      { level_code: 'N5', written: '水', reading: 'みず' },
      { level_code: 'N4', written: '会う', reading: 'あう' },
    ]);

    const n2 = await importLevelLists(pool(), { courseKey: 'ja-en', ceiling: 'N2', dir });
    expect(n2).toMatchObject({ levels: ['N5', 'N4', 'N2'], added: 1, updated: 1, skipped: 5 });
    expect(await levelOf('ja:kanji:逢')).toBe('N2');
    expect(await words()).toContainEqual({ level_code: 'N2', written: '逢う', reading: 'あう' });

    const again = await importLevelLists(pool(), { courseKey: 'ja-en', ceiling: 'N2', dir });
    expect(again).toMatchObject({ added: 0, updated: 0, skipped: 7 });

    const runs = await query<{ importer: string; status: string; summary: object }>(
      pool(),
      `SELECT importer, status, summary FROM import_runs WHERE importer = 'level-lists' ORDER BY id`,
    );
    expect(runs).toEqual(
      [n3, n2, again].map((summary) => ({ importer: 'level-lists', status: 'succeeded', summary })),
    );
  });

  it('keeps author overrides and the level of authored items', async () => {
    const courseId = await seed();
    await setItemOverrides(pool(), 'ja:kanji:水', { meanings: ['H2O'] });
    await insertItem(pool(), {
      courseId,
      key: 'ja:kanji:日',
      type: 'kanji',
      levelCode: 'N4',
      data: {},
      source: null,
      datasetVersion: null,
    });

    await importLevelLists(pool(), { courseKey: 'ja-en', ceiling: 'N3', dir });

    expect(await findItemByKey(pool(), 'ja:kanji:水')).toMatchObject({
      level_code: 'N5',
      overrides: { meanings: ['H2O'] },
    });
    expect(await levelOf('ja:kanji:日')).toBe('N4');
  });

  it('reads the committed copy and makes no network request', async () => {
    await seed();
    const network = [
      jest.spyOn(globalThis, 'fetch'),
      jest.spyOn(http, 'request'),
      jest.spyOn(http, 'get'),
      jest.spyOn(https, 'request'),
      jest.spyOn(https, 'get'),
    ];
    for (const spy of network) {
      spy.mockImplementation(() => {
        throw new Error('network request');
      });
    }
    try {
      const summary = await importLevelLists(pool(), { courseKey: 'ja-en', ceiling: 'N3' });
      expect(summary).toMatchObject({ levels: ['N5', 'N4'], added: 687 + 585, updated: 1 });
      for (const spy of network) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of network) spy.mockRestore();
    }
  });

  it('records a failed run for a ceiling that is not a level', async () => {
    await seed();
    await expect(
      importLevelLists(pool(), { courseKey: 'ja-en', ceiling: 'N9', dir }),
    ).rejects.toThrow(/N9/);
    const [run] = await query<{ status: string }>(
      pool(),
      `SELECT status FROM import_runs WHERE importer = 'level-lists'`,
    );
    expect(run).toEqual({ status: 'failed' });
  });
});

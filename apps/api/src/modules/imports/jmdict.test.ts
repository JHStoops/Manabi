import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { query } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse } from '../../test/fixtures';
import { findItemByKey, insertItem, setItemOverrides } from '../content/queries';
import { importJmdict, importKanjidic2, importLevelLists } from './service';

const FIXTURES = join(__dirname, '../../../../../packages/importers/fixtures');
const file = join(FIXTURES, 'jmdict.xml');

describeWithDb('importJmdict (FR-226, FR-234, DR-02, DR-09)', () => {
  const pool = useTestDatabase();

  /** Course, kanji 水 and 逢, and the fixture level lists up to N2, plus one supplementary word. */
  async function seed() {
    const courseId = await seedCourse(pool());
    await importKanjidic2(pool(), { courseKey: 'ja-en', file: join(FIXTURES, 'kanjidic2.xml') });
    await importLevelLists(pool(), {
      courseKey: 'ja-en',
      ceiling: 'N2',
      dir: join(FIXTURES, 'tanos'),
    });
    await query(
      pool(),
      `INSERT INTO supplementary_words (course_id, level_code, written, reading)
       VALUES ($1, 'N5', '上手', 'かみて')`,
      [courseId],
    );
    return courseId;
  }

  const links = () =>
    query<{ word: string; kanji: string }>(
      pool(),
      `SELECT w.key AS word, k.key AS kanji FROM item_links l
       JOIN items w ON w.id = l.from_item_id JOIN items k ON k.id = l.to_item_id
       WHERE l.kind = 'contains' ORDER BY w.key, k.key`,
    );

  it('imports listed words with their level, links them to kanji and is idempotent', async () => {
    await seed();
    const first = await importJmdict(pool(), { courseKey: 'ja-en', file });

    expect(first).toEqual({
      datasetVersion: '2026-11-17',
      licence: 'CC BY-SA 4.0',
      attribution: expect.stringContaining('JMdict'),
      added: 4,
      updated: 0,
      skipped: 0,
      skippedOwned: [],
      linksAdded: 2,
      unmatched: [{ level: 'N5', written: 'あさって', reading: 'あさって' }],
    });
    expect(await findItemByKey(pool(), 'ja:word:逢う:あう')).toMatchObject({
      type: 'word',
      level_code: 'N2',
      source: 'jmdict',
      dataset_version: '2026-11-17',
      data: {
        written: '逢う',
        reading: 'あう',
        senses: [{ partsOfSpeech: ['v5u', 'vi'], meanings: ['to meet', 'to see'] }],
      },
    });
    expect((await findItemByKey(pool(), 'ja:word:上手:かみて'))?.level_code).toBe('N5');
    // 会 and 上 have no kanji item, so only 水 and 逢 are linked.
    expect(await links()).toEqual([
      { word: 'ja:word:水:みず', kanji: 'ja:kanji:水' },
      { word: 'ja:word:逢う:あう', kanji: 'ja:kanji:逢' },
    ]);

    const second = await importJmdict(pool(), { courseKey: 'ja-en', file });
    expect(second).toMatchObject({ added: 0, updated: 0, skipped: 4, linksAdded: 0 });
    expect(await links()).toHaveLength(2);
  });

  it('turns a newly added supplementary word into a word item on re-import (FR-234)', async () => {
    const courseId = await seed();
    await importJmdict(pool(), { courseKey: 'ja-en', file });
    expect(await findItemByKey(pool(), 'ja:word:人:ひと')).toBeNull();

    await query(
      pool(),
      `INSERT INTO supplementary_words (course_id, level_code, written, reading)
       VALUES ($1, 'N4', '人', 'ひと')`,
      [courseId],
    );
    const summary = await importJmdict(pool(), { courseKey: 'ja-en', file });
    expect(summary).toMatchObject({ added: 1, updated: 0 });
    expect(await findItemByKey(pool(), 'ja:word:人:ひと')).toMatchObject({
      type: 'word',
      level_code: 'N4',
      source: 'jmdict',
    });
  });

  it('keeps overrides on re-import and reports keys an authored item owns', async () => {
    const courseId = await seed();
    await insertItem(pool(), {
      courseId,
      key: 'ja:word:会う:あう',
      type: 'word',
      levelCode: 'N4',
      data: { written: '会う', reading: 'あう', senses: [{ meanings: ['to meet'] }] },
      source: null,
      datasetVersion: null,
    });
    await importJmdict(pool(), { courseKey: 'ja-en', file });
    const overrides = { senses: [{ partsOfSpeech: ['n'], meanings: ['H2O'] }] };
    await setItemOverrides(pool(), 'ja:word:水:みず', overrides);

    const dir = await mkdtemp(join(tmpdir(), 'jmdict-'));
    try {
      const changed = join(dir, 'jmdict.xml');
      const xml = await readFile(file, 'utf8');
      await writeFile(changed, xml.replace('<gloss>cold water</gloss>', '<gloss>fluid</gloss>'));
      const summary = await importJmdict(pool(), { courseKey: 'ja-en', file: changed });
      expect(summary).toMatchObject({
        added: 0,
        updated: 1,
        skipped: 3,
        skippedOwned: ['ja:word:会う:あう'],
      });
    } finally {
      await rm(dir, { recursive: true });
    }

    expect(await findItemByKey(pool(), 'ja:word:水:みず')).toMatchObject({
      data: { senses: [{ partsOfSpeech: ['n'], meanings: ['water', 'fluid'] }] },
      overrides,
    });
    expect(await findItemByKey(pool(), 'ja:word:会う:あう')).toMatchObject({ source: null });
  });

  it('fails the run when the level lists have not been imported', async () => {
    await seedCourse(pool());
    await expect(importJmdict(pool(), { courseKey: 'ja-en', file })).rejects.toThrow(
      /run the level-list import first/,
    );
    expect(await query(pool(), `SELECT status FROM import_runs`)).toEqual([{ status: 'failed' }]);
  });
});

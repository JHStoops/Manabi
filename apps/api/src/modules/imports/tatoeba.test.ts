import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { query } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse } from '../../test/fixtures';
import { insertItem } from '../content/queries';
import { upsertLevelListWords } from './queries';
import { importTatoeba } from './service';

const dir = join(__dirname, '../../../../../packages/importers/fixtures/tatoeba');

describeWithDb('importTatoeba (FR-226, FR-235, FR-238, DR-11, NFR-62)', () => {
  const pool = useTestDatabase();

  /** Level-list words for the fixture's kept sentences, and word items for all but 下さる. */
  async function seed() {
    const courseId = await seedCourse(pool());
    const words = [
      { level: 'N5', written: '水', reading: 'みず' },
      { level: 'N5', written: '私', reading: 'わたし' },
      { level: 'N5', written: '学生', reading: 'がくせい' },
      { level: 'N5', written: '今日', reading: 'きょう' },
      { level: 'N4', written: '暑い', reading: 'あつい' },
      { level: 'N4', written: '下さる', reading: 'くださる' },
    ];
    await upsertLevelListWords(pool(), { courseId, words });
    for (const { level, written, reading } of words.slice(0, 5)) {
      await insertItem(pool(), {
        courseId,
        key: `ja:word:${written}:${reading}`,
        type: 'word',
        levelCode: level,
        data: { written, reading, meanings: ['x'] },
        source: 'jmdict',
        datasetVersion: '2026-11-17',
      });
    }
  }

  const sentence = (sourceId: string) =>
    query<Record<string, unknown>>(
      pool(),
      `SELECT text, translation, tokens, attribution, review_status, vocab_level_code
       FROM sentences WHERE source = 'tatoeba' AND source_id = $1`,
      [sourceId],
    ).then((rows) => rows[0]);
  const links = () =>
    query<{ sentence: string; word: string }>(
      pool(),
      `SELECT s.source_id AS sentence, i.key AS word FROM sentence_items si
       JOIN sentences s ON s.id = si.sentence_id JOIN items i ON i.id = si.item_id
       ORDER BY s.source_id, i.key`,
    );

  it('imports the kept sentences with tiles, links and attribution, and is idempotent', async () => {
    await seed();
    const first = await importTatoeba(pool(), { courseKey: 'ja-en', file: dir });

    expect(first).toEqual({
      datasetVersion: '2026-11-11',
      licence: 'CC BY 2.0 FR',
      attribution: 'Tatoeba contributors',
      added: 3,
      updated: 0,
      skipped: 0,
      tilesKept: 0,
      dropped: { noTranslation: 1, latin: 1, tooLong: 1, notNative: 2, unknownWords: 1 },
    });
    const water = await sentence('143718');
    const ids = new Map(
      (await query<{ key: string; id: number }>(pool(), `SELECT key, id FROM items`)).map((r) => [
        r.key,
        r.id,
      ]),
    );
    expect(water).toEqual({
      text: '水をください。',
      translation: 'Can I have some water, please?',
      tokens: [
        { surface: '水', base: '水', reading: 'みず', itemId: ids.get('ja:word:水:みず') },
        { surface: 'を', base: 'を', reading: 'を', itemId: null },
        // 下さる is a level-list word with no item yet.
        { surface: 'ください', base: 'くださる', reading: 'ください', itemId: null },
      ],
      attribution: {
        sentence: {
          sourceId: '143718',
          owner: 'bunbuku',
          url: 'https://tatoeba.org/en/sentences/show/143718',
          licence: 'CC BY 2.0 FR',
          datasetVersion: '2026-11-11',
        },
        translation: {
          sourceId: '64352',
          owner: 'CK',
          url: 'https://tatoeba.org/en/sentences/show/64352',
          licence: 'CC BY 2.0 FR',
          datasetVersion: '2026-11-11',
        },
        otherTranslationIds: ['250149', '250150', '270848', '2132096'],
      },
      review_status: 'unreviewed',
      vocab_level_code: 'N4',
    });
    expect(await links()).toEqual([
      { sentence: '143718', word: 'ja:word:水:みず' },
      { sentence: '157843', word: 'ja:word:学生:がくせい' },
      { sentence: '157843', word: 'ja:word:私:わたし' },
      { sentence: '171592', word: 'ja:word:今日:きょう' },
      { sentence: '171592', word: 'ja:word:暑い:あつい' },
    ]);

    const second = await importTatoeba(pool(), { courseKey: 'ja-en', file: dir });
    expect(second).toMatchObject({ added: 0, updated: 0, skipped: 3, tilesKept: 0 });
    expect(await links()).toHaveLength(5);
    expect(await query(pool(), `SELECT count(*)::int AS n FROM sentences`)).toEqual([{ n: 3 }]);
  });

  it('never overwrites edited or reviewed tiles, or edited text, on re-import', async () => {
    await seed();
    await importTatoeba(pool(), { courseKey: 'ja-en', file: dir });
    const authorTiles = [
      { surface: '水をください', base: '水をください', reading: 'みずをください' },
    ];
    await query(
      pool(),
      `UPDATE sentences SET tokens = $1, tokens_edited = true WHERE source_id = '143718'`,
      [JSON.stringify(authorTiles)],
    );
    await query(
      pool(),
      `UPDATE sentences SET text = '私は学生だ。', edited = true WHERE source_id = '157843'`,
    );
    await query(
      pool(),
      `UPDATE sentences SET tokens = '[]', review_status = 'reviewed' WHERE source_id = '171592'`,
    );
    await query(pool(), `DELETE FROM sentence_items`);

    // A new dataset version updates every row's attribution.
    const next = await mkdtemp(join(tmpdir(), 'tatoeba-'));
    try {
      await cp(dir, next, { recursive: true });
      await writeFile(join(next, 'manifest.json'), '{ "version": "2026-12-01" }\n');
      const summary = await importTatoeba(pool(), { courseKey: 'ja-en', file: next });
      expect(summary).toMatchObject({ added: 0, updated: 3, skipped: 0, tilesKept: 3 });
    } finally {
      await rm(next, { recursive: true });
    }

    expect((await sentence('143718'))?.tokens).toEqual(authorTiles);
    expect(await sentence('157843')).toMatchObject({
      text: '私は学生だ。',
      attribution: {
        sentence: { datasetVersion: '2026-11-11' },
        translation: { datasetVersion: '2026-12-01' },
      },
    });
    expect((await sentence('171592'))?.tokens).toEqual([]);
    expect(await links()).toEqual([]);
  });

  it('fails the run when the level lists have not been imported', async () => {
    await seedCourse(pool());
    await expect(importTatoeba(pool(), { courseKey: 'ja-en', file: dir })).rejects.toThrow(
      /run the level-list import first/,
    );
    expect(await query(pool(), `SELECT status FROM import_runs`)).toEqual([{ status: 'failed' }]);
  });
});

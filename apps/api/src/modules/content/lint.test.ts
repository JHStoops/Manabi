import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { query, queryOne } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { lintPack } from './lint';
import { readPack } from './packFiles';
import { insertItem } from './queries';
import type { JsonObject } from './rows';
import { importPack } from './service';

// FR-228 content lint over small fixture packs: the clean fixture, edited one problem at a time.

const FIXTURE = join(__dirname, '../../test/fixtures/ja-en');
const tmpDirs: string[] = [];

afterAll(async () => {
  for (const dir of tmpDirs) await rm(dir, { recursive: true, force: true });
});

/** A copy of the fixture with `edits` applied: each replaces `from` with `to` in a file. */
async function fixture(...edits: [file: string, from: string, to: string][]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'manabi-lint-'));
  tmpDirs.push(dir);
  await cp(FIXTURE, dir, { recursive: true });
  for (const [file, from, to] of edits) {
    const text = await readFile(join(dir, file), 'utf8');
    if (!text.includes(from)) throw new Error(`${file} has no ${from}`);
    await writeFile(join(dir, file), text.replace(from, to));
  }
  return dir;
}

const UNKNOWN_LESSON_ITEM: [string, string, string] = [
  'units/01-hiragana.yaml',
  'items: [ja:kana:あ, ja:kana:い]',
  'items: [ja:kana:あ, ja:kana:ん]',
];

describe('pack lint file checks', () => {
  it('passes the fixture and content/ja-en', async () => {
    expect(await lintPack(FIXTURE, null)).toEqual([]);
    expect(await lintPack(join(__dirname, '../../../../../content/ja-en'), null)).toEqual([]);
  });

  it('reports schema errors with file and line', async () => {
    const dir = await fixture(['units/02-ordering.yaml', 'type: vocabulary', 'type: boss']);
    expect(await lintPack(dir, null)).toEqual([
      expect.stringMatching(/^units\/02-ordering\.yaml:6: lessons\.0\.type: Invalid option/),
    ]);
  });

  it('reports invalid exercise payloads with file, line and path', async () => {
    const dir = await fixture(
      ['units/02-ordering.yaml', 'answerLanguage: target', 'answerLanguage: ja'],
      ['units/02-ordering.yaml', 'tiles: [{ surface: 水,', 'tiles: [{'],
    );
    const label = 'lesson ja-en:n5:ordering:words exercise';
    expect(await lintPack(dir, null)).toEqual([
      expect.stringMatching(
        new RegExp(
          `^units/02-ordering\\.yaml:16: ${label} build-water: payload\\.answer\\.tiles\\.0\\.surface: `,
        ),
      ),
      expect.stringMatching(
        new RegExp(`^units/02-ordering\\.yaml:23: ${label} type-water: payload\\.answerLanguage: `),
      ),
    ]);
  });

  it('reports YAML syntax errors with file and line', async () => {
    const dir = await fixture(['units/02-ordering.yaml', 'title: Ordering', 'title: [']);
    expect(await lintPack(dir, null)).toEqual([
      expect.stringMatching(/^units\/02-ordering\.yaml:4: /),
    ]);
  });

  it('reports the checks it shares with import, with file and line', async () => {
    const dir = await fixture(
      ['units/02-ordering.yaml', 'section: ja-en:n5', 'section: ja-en:n9'],
      ['items/kana.yaml', 'romaji: i', 'romaji: I'],
      ['lists/blocked-words.yaml', '- 殺す', '- 殺す\n- ばか'],
    );
    expect(await lintPack(dir, null)).toEqual([
      'lists/blocked-words.yaml:3: duplicate blocked word ばか',
      'units/02-ordering.yaml:2: unit ja-en:n5:ordering: unknown section ja-en:n9',
      expect.stringMatching(/^items\/kana\.yaml:8: item ja:kana:い: data\.romaji: /),
    ]);
  });

  it('reports grammar data problems at the front matter', async () => {
    const dir = await fixture(['grammar/wo-kudasai.md', 'pattern: 〜をください', 'pattern: 123']);
    expect(await lintPack(dir, null)).toEqual([
      expect.stringMatching(
        /^grammar\/wo-kudasai\.md:2: item ja:grammar:wo-kudasai: data\.pattern: /,
      ),
    ]);
  });

  it('reports a blocked word in an authored sentence, not in an imported one', async () => {
    // です is in the authored sentence 水です。; を only in the imported 水をください。.
    const dir = await fixture(['lists/blocked-words.yaml', '- 殺す', '- 殺す\n- です\n- を']);
    expect(await lintPack(dir, null)).toEqual([
      'sentences.yaml:29: sentence "水です。": blocked word です',
    ]);
  });

  it('reports an exercise item not taught in its lesson or an earlier one (FR-048)', async () => {
    const exercise = (key: string) =>
      `\n    exercises:\n      - key: ${key}\n        type: typed_answer\n        payload:\n          prompt: water\n          answerLanguage: target\n          accept: [{ text: 水, tiles: [{ surface: 水, base: 水, reading: みず, item: ja:word:水:みず }] }]`;
    const later = await fixture([
      'units/01-hiragana.yaml',
      'items: [ja:kana:あ, ja:kana:い]',
      `items: [ja:kana:あ, ja:kana:い]${exercise('early')}`,
    ]);
    expect(await lintPack(later, null)).toEqual([
      'units/01-hiragana.yaml:17: lesson ja-en:kana:hiragana:a-i exercise early: item ja:word:水:みず is not taught in this lesson or an earlier one',
    ]);
    const earlier = await fixture([
      'units/02-ordering.yaml',
      'items: [ja:grammar:wo-kudasai]',
      `items: [ja:grammar:wo-kudasai]${exercise('recall')}`,
    ]);
    expect(await lintPack(earlier, null)).toEqual([]);
  });

  it('reports a blocked word in exercise tiles and in answer text import segments (FR-237)', async () => {
    const dir = await fixture(
      ['lists/blocked-words.yaml', '- 殺す', '- 殺す\n- 火'],
      ['units/02-ordering.yaml', 'accept: [{ text: 水 }]', 'accept: [{ text: 火 }]'],
    );
    const label = 'lesson ja-en:n5:ordering:words exercise';
    expect(await lintPack(dir, null)).toEqual([
      `units/02-ordering.yaml:17: ${label} build-water: blocked word 火`,
      `units/02-ordering.yaml:22: ${label} type-water: blocked word 火 in "火"`,
    ]);
  });

  it('reports a sentence or authored word without a reading', async () => {
    const noTiles = await fixture([
      'sentences.yaml',
      '  tiles:\n    - { surface: 水, base: 水, reading: みず, item: ja:word:水:みず }\n    - { surface: です, base: です, reading: です }\n  challengeOverride',
      '  tiles: []\n  challengeOverride',
    ]);
    expect(await lintPack(noTiles, null)).toEqual([
      'sentences.yaml:28: sentence "水です。": no reading to generate audio from',
    ]);

    const noReading = await fixture(['items/word.yaml', 'reading: みず, ', '']);
    expect(await lintPack(noReading, null)).toEqual([
      expect.stringMatching(/^items\/word\.yaml:4: item ja:word:水:みず: data\.reading: /),
      'items/word.yaml:1: item ja:word:水:みず: no reading to generate audio from',
    ]);
  });

  it('leaves links to items the pack does not author to the database checks', async () => {
    expect(await lintPack(await fixture(UNKNOWN_LESSON_ITEM), null)).toEqual([]);
  });
});

describeWithDb('pack lint database checks', () => {
  const pool = useTestDatabase();

  /** Imports the fixture and gives its kana stroke data, so the fixture lints clean. */
  async function importFixture(): Promise<number> {
    await importPack(pool(), await readPack(FIXTURE));
    await query(
      pool(),
      `INSERT INTO stroke_data (item_id, strokes)
       SELECT id, '{"strokes": [], "medians": []}' FROM items WHERE key LIKE 'ja:kana:%'`,
    );
    return (await queryOne<{ id: number }>(pool(), 'SELECT id FROM courses'))!.id;
  }

  /** An item a dataset importer would have created. */
  const importItem = (courseId: number, key: string, type: string, data: JsonObject) =>
    insertItem(pool(), {
      courseId,
      key,
      type,
      levelCode: 'N5',
      data,
      source: 'test',
      datasetVersion: '1',
    });

  const kanji = {
    character: '水',
    meanings: ['water'],
    onReadings: ['スイ'],
    kunReadings: ['みず'],
    strokeCount: 4,
  };

  it('passes the imported fixture with stroke data', async () => {
    await importFixture();
    expect(await lintPack(FIXTURE, pool())).toEqual([]);
  });

  it('reports a course that is not in the database', async () => {
    expect(await lintPack(FIXTURE, pool())).toEqual([
      'course.yaml:2: course ja-en is not in the database: import the pack and the datasets first',
    ]);
  });

  it('reports character items without stroke data, authored or imported', async () => {
    const courseId = await importFixture();
    await query(pool(), 'DELETE FROM stroke_data');
    await importItem(courseId, 'ja:kanji:水', 'kanji', kanji);
    const dir = await fixture([
      'units/02-ordering.yaml',
      'items: [ja:word:水:みず]',
      'items: [ja:word:水:みず, ja:kanji:水]',
    ]);
    expect(await lintPack(dir, pool())).toEqual([
      `items/kana.yaml:1: item ja:kana:あ: no stroke data for あ (import the pack, then the course's stroke data)`,
      `items/kana.yaml:5: item ja:kana:い: no stroke data for い (import the pack, then the course's stroke data)`,
      `units/02-ordering.yaml:8: item ja:kanji:水: no stroke data for 水 (import the pack, then the course's stroke data)`,
    ]);
  });

  it('reports links to items the course does not have, in lessons, tiles and related', async () => {
    await importFixture();
    const dir = await fixture(
      UNKNOWN_LESSON_ITEM,
      [
        'sentences.yaml',
        '{ surface: です, base: です, reading: です }',
        '{ surface: です, base: です, reading: です, item: ja:word:x }',
      ],
      ['grammar/wo-kudasai.md', 'related: [ja:grammar:te-kudasai]', 'related: [ja:grammar:nai]'],
    );
    expect(await lintPack(dir, pool())).toEqual([
      'units/01-hiragana.yaml:10: lesson ja-en:kana:hiragana:a-i: no item ja:kana:ん in the course',
      'sentences.yaml:30: sentence "水です。" tile: no item ja:word:x in the course',
      'grammar/wo-kudasai.md:4: item ja:grammar:wo-kudasai related: no item ja:grammar:nai in the course',
    ]);
  });

  it('reports overrides for items no importer created, or that the plugin rejects', async () => {
    const courseId = await importFixture();
    await importItem(courseId, 'ja:kanji:水', 'kanji', kanji);
    await query(
      pool(),
      `INSERT INTO stroke_data (item_id, strokes) SELECT id, '{}' FROM items WHERE key = 'ja:kanji:水'`,
    );
    const dir = await fixture([
      'items/word.yaml',
      '- key: ja:word:水:みず',
      '- key: ja:kanji:火\n  type: kanji\n- key: ja:kanji:水\n  type: kanji\n  overrides: { strokeCount: 0 }\n- key: ja:word:水:みず',
    ]);
    expect(await lintPack(dir, pool())).toEqual([
      'items/word.yaml:1: item ja:kanji:火: no imported kanji item with this key',
      expect.stringMatching(/^items\/word\.yaml:5: item ja:kanji:水: data\.strokeCount: /),
    ]);
  });

  it('reports overrides for an item the pack authored before, as import does', async () => {
    await importFixture();
    const dir = await fixture([
      'items/kana.yaml',
      '  level: kana\n  data: { character: あ, script: hiragana, romaji: a }\n',
      '',
    ]);
    expect(await lintPack(dir, pool())).toEqual([
      'items/kana.yaml:1: item ja:kana:あ: no imported kana item with this key',
    ]);
  });

  it('reports an imported word without a reading', async () => {
    const courseId = await importFixture();
    // Imported data is validated at import, so only a broken row lacks its reading.
    await importItem(courseId, 'ja:word:火:ひ', 'word', {
      written: '火',
      senses: [{ meanings: ['fire'] }],
    });
    const dir = await fixture([
      'units/02-ordering.yaml',
      'items: [ja:word:水:みず]',
      'items: [ja:word:水:みず, ja:word:火:ひ]',
    ]);
    expect(await lintPack(dir, pool())).toEqual([
      'units/02-ordering.yaml:8: item ja:word:火:ひ: no reading to generate audio from',
    ]);
  });
});

import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { ContentPackError } from '@manabi/core';
import type { ContentPack } from '@manabi/core';
import { query, queryOne } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { insertItem } from './queries';
import { readPack, writePack } from './packFiles';
import { exportPack, importPack } from './service';

// Integration tests for content pack import and export (FR-227, FR-232, DR-02, DR-03). Raw SQL
// here seeds progress and snapshots tables; application code keeps its SQL in queries.ts files.

const FIXTURE = join(__dirname, '../../test/fixtures/ja-en');

const CONTENT_TABLES: Record<string, string> = {
  courses: 'id',
  sections: 'id',
  units: 'id',
  lessons: 'id',
  items: 'id',
  item_links: 'from_item_id, to_item_id, kind',
  lesson_items: 'lesson_id, item_id',
  sentences: 'id',
  sentence_items: 'sentence_id, item_id',
};

const PROGRESS_TABLES: Record<string, string> = {
  enrollments: 'user_id, course_id',
  lesson_progress: 'user_id, lesson_id',
  item_progress: 'user_id, item_id, facet',
  review_log: 'id',
  xp_events: 'id',
  user_stats: 'user_id',
};

async function snapshot(pool: Pool, tables: Record<string, string>) {
  const out: Record<string, unknown[]> = {};
  for (const [table, order] of Object.entries(tables)) {
    // Table and column names are constants above, never input.
    const rows = await query(pool, `SELECT * FROM ${table} ORDER BY ${order}`);
    out[table] = rows.map(({ updated_at: _updated, ...row }) => row);
  }
  return out;
}

async function lessonId(pool: Pool, key: string): Promise<number> {
  const row = await queryOne<{ id: number }>(pool, 'SELECT id FROM lessons WHERE key = $1', [key]);
  return row!.id;
}

/** A learner who completed `lessonKeys`, with review, XP and streak rows. */
async function seedProgress(pool: Pool, lessonKeys: string[]): Promise<void> {
  const user = await seedUser(pool);
  const course = await queryOne<{ id: number }>(pool, `SELECT id FROM courses`);
  const item = await queryOne<{ id: number }>(
    pool,
    `SELECT id FROM items WHERE key = 'ja:kana:あ'`,
  );
  await query(
    pool,
    `INSERT INTO enrollments (user_id, course_id, total_xp, level) VALUES ($1, $2, 30, 2)`,
    [user.id, course!.id],
  );
  for (const key of lessonKeys) {
    await query(
      pool,
      `INSERT INTO lesson_progress (user_id, lesson_id, completed_at, best_accuracy)
       VALUES ($1, $2, now() - interval '1 day', 90)`,
      [user.id, await lessonId(pool, key)],
    );
  }
  await query(
    pool,
    `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
     VALUES ($1, $2, 'meaning', 3, now() + interval '1 day')`,
    [user.id, item!.id],
  );
  await query(
    pool,
    `INSERT INTO review_log (user_id, item_id, facet, exercise_type, correct, stage_before, stage_after)
     VALUES ($1, $2, 'meaning', 'choice', true, 2, 3)`,
    [user.id, item!.id],
  );
  await query(
    pool,
    `INSERT INTO xp_events (user_id, course_id, base_amount, amount, reason, local_date)
     VALUES ($1, $2, 30, 30, 'lesson_new', (now() AT TIME ZONE 'UTC')::date)`,
    [user.id, course!.id],
  );
  await query(
    pool,
    `INSERT INTO user_stats (user_id, current_streak, longest_streak, last_active_date)
     VALUES ($1, 4, 9, current_date)`,
    [user.id],
  );
}

const unit = (pack: ContentPack, key: string) => pack.units.find((u) => u.key === key)!;

describeWithDb('content packs', () => {
  const pool = useTestDatabase();
  const tmpDirs: string[] = [];
  const tmp = async () => {
    const dir = await mkdtemp(join(tmpdir(), 'manabi-pack-'));
    tmpDirs.push(dir);
    return dir;
  };
  afterAll(async () => {
    for (const dir of tmpDirs) await rm(dir, { recursive: true, force: true });
  });

  it('imports the minimal fixture pack', async () => {
    await importPack(pool(), await readPack(FIXTURE));

    const lessons = await query<{ key: string; position: number; status: string }>(
      pool(),
      'SELECT key, position, status FROM lessons ORDER BY unit_id, position',
    );
    expect(lessons).toEqual([
      { key: 'ja-en:kana:hiragana:a-i', position: 0, status: 'published' },
      { key: 'ja-en:kana:hiragana:review', position: 1, status: 'published' },
      { key: 'ja-en:n5:ordering:words', position: 0, status: 'draft' },
      { key: 'ja-en:n5:ordering:please', position: 1, status: 'draft' },
    ]);
    const sections = await query(
      pool(),
      'SELECT key, position, level_code FROM sections ORDER BY position',
    );
    expect(sections).toEqual([
      { key: 'ja-en:kana', position: 0, level_code: 'kana' },
      { key: 'ja-en:n5', position: 1, level_code: 'N5' },
    ]);
    const grammar = await queryOne<{ data: Record<string, unknown> }>(
      pool(),
      `SELECT data FROM items WHERE key = 'ja:grammar:wo-kudasai'`,
    );
    expect(grammar!.data).toEqual({
      pattern: '〜をください',
      meaning: 'please give me ~',
      explanation: 'Put **を** after the thing you want, then **ください**.',
    });
    const related = await query(
      pool(),
      `SELECT f.key AS "from", t.key AS "to" FROM item_links l
       JOIN items f ON f.id = l.from_item_id JOIN items t ON t.id = l.to_item_id`,
    );
    expect(related).toEqual([{ from: 'ja:grammar:wo-kudasai', to: 'ja:grammar:te-kudasai' }]);

    const water = await queryOne<{ id: number; overrides: unknown }>(
      pool(),
      `SELECT id, overrides FROM items WHERE key = 'ja:word:水:みず'`,
    );
    expect(water!.overrides).toEqual({ meanings: ['water', 'cold water'] });
    const sentences = await query<{ tokens: { itemId?: number }[]; attribution: unknown }>(
      pool(),
      'SELECT tokens, attribution, challenge_override FROM sentences ORDER BY id',
    );
    expect(sentences[0]!.tokens[0]!.itemId).toBe(water!.id);
    expect(sentences[1]).toMatchObject({ attribution: null, challenge_override: false });
    const links = await query(pool(), 'SELECT item_id FROM sentence_items');
    expect(links).toEqual([{ item_id: water!.id }, { item_id: water!.id }]);
  });

  it('round trips: import, export, import yields identical rows', async () => {
    await importPack(pool(), await readPack(FIXTURE));
    const before = await snapshot(pool(), CONTENT_TABLES);
    const exported = await exportPack(pool(), 'ja-en');

    const dir = await tmp();
    await writePack(dir, exported);
    await importPack(pool(), await readPack(dir));

    expect(await snapshot(pool(), CONTENT_TABLES)).toEqual(before);
    expect(await exportPack(pool(), 'ja-en')).toEqual(exported);
  });

  it('archives a lesson removed from the pack and leaves progress unchanged', async () => {
    const pack = await readPack(FIXTURE);
    await importPack(pool(), pack);
    await seedProgress(pool(), ['ja-en:kana:hiragana:a-i']);
    const progress = await snapshot(pool(), PROGRESS_TABLES);
    const removedId = await lessonId(pool(), 'ja-en:kana:hiragana:a-i');

    unit(pack, 'ja-en:kana:hiragana').lessons.shift();
    await importPack(pool(), pack);

    const lessons = await query(
      pool(),
      `SELECT id, key, position, archived_at IS NOT NULL AS archived FROM lessons
       WHERE unit_id = (SELECT unit_id FROM lessons WHERE id = $1) ORDER BY position`,
      [removedId],
    );
    // The archived lesson keeps its id and moves after the active one.
    expect(lessons).toEqual([
      expect.objectContaining({ key: 'ja-en:kana:hiragana:review', position: 0, archived: false }),
      { id: removedId, key: 'ja-en:kana:hiragana:a-i', position: 1, archived: true },
    ]);
    expect(await snapshot(pool(), PROGRESS_TABLES)).toEqual(progress);
  });

  it('adding a lesson to a completed unit keeps the unit and its completions', async () => {
    const pack = await readPack(FIXTURE);
    await importPack(pool(), pack);
    const hiragana = unit(pack, 'ja-en:kana:hiragana');
    await seedProgress(
      pool(),
      hiragana.lessons.map((l) => l.key),
    );
    const progress = await snapshot(pool(), PROGRESS_TABLES);
    const before = await query(pool(), 'SELECT * FROM units ORDER BY id');
    const lessonsBefore = await query(pool(), 'SELECT id, key, status FROM lessons ORDER BY id');

    hiragana.lessons.splice(1, 0, {
      key: 'ja-en:kana:hiragana:u-e',
      type: 'kana',
      title: 'う and え',
      status: 'published',
      items: [],
    });
    await importPack(pool(), pack);

    // The unit and every lesson the learner completed keep their ids, status and completion, and
    // nothing is archived, so the path's unlock rule (#24) still sees a completed unit followed
    // by an unlocked one. The new lesson is simply not completed yet.
    const after = await query(pool(), 'SELECT * FROM units ORDER BY id');
    expect(after.map(({ updated_at: _u, ...u }) => u)).toEqual(
      before.map(({ updated_at: _u, ...u }) => u),
    );
    const lessonsAfter = await query<{ id: number; key: string }>(
      pool(),
      'SELECT id, key, status FROM lessons WHERE archived_at IS NULL ORDER BY id',
    );
    expect(lessonsAfter.slice(0, lessonsBefore.length)).toEqual(lessonsBefore);
    expect(lessonsAfter.at(-1)!.key).toBe('ja-en:kana:hiragana:u-e');
    expect(await snapshot(pool(), PROGRESS_TABLES)).toEqual(progress);
  });

  it('re-importing an edited pack never changes progress tables', async () => {
    const pack = await readPack(FIXTURE);
    await importPack(pool(), pack);
    await seedProgress(pool(), ['ja-en:kana:hiragana:a-i', 'ja-en:n5:ordering:words']);
    const progress = await snapshot(pool(), PROGRESS_TABLES);

    // Retitle, move a lesson to another unit, drop a section, unit, item and sentence.
    const hiragana = unit(pack, 'ja-en:kana:hiragana');
    hiragana.title = 'Hiragana basics';
    hiragana.lessons.push(unit(pack, 'ja-en:n5:ordering').lessons[0]!);
    hiragana.lessons[2]!.items = [];
    pack.units = [hiragana];
    pack.course.sections = pack.course.sections.slice(0, 1);
    pack.items = pack.items.filter((i) => i.key !== 'ja:word:水:みず' && i.type !== 'grammar');
    pack.sentences = [];
    await importPack(pool(), pack);

    expect(await snapshot(pool(), PROGRESS_TABLES)).toEqual(progress);
    const archived = await query(
      pool(),
      `SELECT 'item' AS kind, key FROM items WHERE archived_at IS NOT NULL
       UNION ALL SELECT 'unit', key FROM units WHERE archived_at IS NOT NULL
       UNION ALL SELECT 'section', key FROM sections WHERE archived_at IS NOT NULL
       UNION ALL SELECT 'lesson', key FROM lessons WHERE archived_at IS NOT NULL
       ORDER BY 1, 2`,
    );
    expect(archived).toEqual([
      { kind: 'item', key: 'ja:grammar:te-kudasai' },
      { kind: 'item', key: 'ja:grammar:wo-kudasai' },
      { kind: 'item', key: 'ja:word:水:みず' },
      { kind: 'lesson', key: 'ja-en:n5:ordering:please' },
      { kind: 'section', key: 'ja-en:n5' },
      { kind: 'unit', key: 'ja-en:n5:ordering' },
    ]);
    // Only the authored sentence is archived; the imported one belongs to its importer.
    const sentences = await query(
      pool(),
      'SELECT source, archived_at IS NOT NULL AS archived FROM sentences ORDER BY id',
    );
    expect(sentences).toEqual([
      { source: 'tatoeba', archived: false },
      { source: null, archived: true },
    ]);
    // Nothing was deleted, and a re-added row comes back with its id.
    await importPack(pool(), await readPack(FIXTURE));
    expect(await query(pool(), 'SELECT key FROM lessons WHERE archived_at IS NOT NULL')).toEqual(
      [],
    );
    expect(await snapshot(pool(), PROGRESS_TABLES)).toEqual(progress);
  });

  it('never overwrites tiles an author has edited or reviewed', async () => {
    const pack = await readPack(FIXTURE);
    await importPack(pool(), pack);
    const tiles = () =>
      query<{ tokens: unknown[] }>(pool(), 'SELECT tokens FROM sentences ORDER BY id');
    const original = await tiles();

    const oneTile = [{ surface: '水です', base: '水です', reading: 'みずです' }];
    for (const s of pack.sentences) s.tiles = oneTile;
    await importPack(pool(), pack);
    // The first sentence is reviewed, so it keeps its tiles; the second takes the pack's.
    expect((await tiles()).map((r) => r.tokens)).toEqual([original[0]!.tokens, oneTile]);
    expect(await query(pool(), 'SELECT count(*)::int AS n FROM sentence_items')).toEqual([
      { n: 1 },
    ]);

    await query(pool(), 'UPDATE sentences SET tokens_edited = true WHERE source IS NULL');
    for (const s of pack.sentences) s.tiles = [{ surface: '水', base: '水', reading: 'みず' }];
    pack.sentences[1]!.tokensEdited = false;
    await importPack(pool(), pack);
    expect((await tiles())[1]!.tokens).toEqual(oneTile);
    const flags = await queryOne(
      pool(),
      'SELECT tokens_edited FROM sentences WHERE source IS NULL',
    );
    expect(flags).toEqual({ tokens_edited: true });
  });

  it('applies overrides to dataset-imported items', async () => {
    const pack = await readPack(FIXTURE);
    await importPack(pool(), pack);
    const course = await queryOne<{ id: number }>(pool(), 'SELECT id FROM courses');
    await insertItem(pool(), {
      courseId: course!.id,
      key: 'ja:kanji:水',
      type: 'kanji',
      levelCode: 'N5',
      data: {
        character: '水',
        meanings: ['water'],
        onReadings: ['スイ'],
        kunReadings: ['みず'],
        strokeCount: 4,
      },
      source: 'kanjidic2',
      datasetVersion: '2026-10-01',
    });
    pack.items.push({
      key: 'ja:kanji:水',
      type: 'kanji',
      level: null,
      overrides: { meanings: ['water', 'aqua'] },
    });
    await importPack(pool(), pack);

    const kanji = await queryOne(
      pool(),
      `SELECT data, overrides, archived_at FROM items WHERE key = 'ja:kanji:水'`,
    );
    expect(kanji).toMatchObject({ overrides: { meanings: ['water', 'aqua'] }, archived_at: null });
    const exported = await exportPack(pool(), 'ja-en');
    expect(exported.items).toContainEqual({
      key: 'ja:kanji:水',
      type: 'kanji',
      level: null,
      overrides: { meanings: ['water', 'aqua'] },
    });

    // Dropping the entry leaves the imported item alone: it belongs to its importer.
    pack.items.pop();
    await importPack(pool(), pack);
    expect(
      await queryOne(pool(), `SELECT archived_at FROM items WHERE key = 'ja:kanji:水'`),
    ).toEqual({
      archived_at: null,
    });
  });

  it('reports schema errors with file and path', async () => {
    const dir = await tmp();
    await cp(FIXTURE, dir, { recursive: true });
    await writeFile(
      join(dir, 'units/02-ordering.yaml'),
      'key: u\nsection: ja-en:n5\ntitle: U\nlessons:\n  - { key: l, type: boss, title: L }\n',
    );
    await writeFile(join(dir, 'grammar/broken.md'), 'no front matter');
    await writeFile(join(dir, 'items/word.yaml'), '- key: [unclosed');

    const err = await readPack(dir).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ContentPackError);
    const problems = (err as ContentPackError).problems;
    expect(problems).toEqual([
      expect.stringMatching(/^units\/02-ordering\.yaml: lessons\.0\.type: Invalid enum value/),
      expect.stringMatching(/^items\/word\.yaml: /),
      'grammar/broken.md: (root): expected YAML front matter between --- lines',
    ]);
  });

  it.each<[string, (pack: ContentPack) => void, string]>([
    [
      'an unknown item key in a lesson',
      (p) => p.units[0]!.lessons[0]!.items.push('ja:kana:ん'),
      'lesson ja-en:kana:hiragana:a-i: no active item ja:kana:ん in the course',
    ],
    [
      'an unknown item key in a tile',
      (p) => (p.sentences[1]!.tiles[0]!.item = 'ja:word:x'),
      'sentence "水です。" tile: no active item ja:word:x in the course',
    ],
    [
      'item data the plugin rejects',
      (p) => (p.items[0]!.data = { character: 'あ', script: 'hiragana' }),
      'item ja:kana:あ: data.romaji: Required',
    ],
    [
      'an item type the plugin lacks',
      (p) => (p.items[0]!.type = 'radical'),
      'item ja:kana:あ: Language plugin "ja" has no item type "radical"',
    ],
    [
      'an override for an item no importer created',
      (p) => p.items.push({ key: 'ja:kanji:火', type: 'kanji', level: null, overrides: {} }),
      'item ja:kanji:火: no imported kanji item with this key',
    ],
    [
      'an unknown section',
      (p) => (p.units[0]!.section = 'ja-en:n9'),
      'unit ja-en:kana:hiragana: unknown section ja-en:n9',
    ],
    [
      'a duplicate lesson key',
      (p) => p.units[1]!.lessons.push(p.units[0]!.lessons[0]!),
      'duplicate lesson ja-en:kana:hiragana:a-i',
    ],
    [
      'an unknown plugin',
      (p) => (p.course.plugin = 'xx'),
      'course.yaml: plugin: unknown plugin xx',
    ],
  ])('rejects %s and writes nothing', async (_name, edit, problem) => {
    const pack = await readPack(FIXTURE);
    edit(pack);
    await expect(importPack(pool(), pack)).rejects.toMatchObject({ problems: [problem] });
    expect(await query(pool(), 'SELECT id FROM courses')).toEqual([]);
  });

  it('rejects an export of an unknown course', async () => {
    await expect(exportPack(pool(), 'xx-en')).rejects.toMatchObject({
      problems: ['no course xx-en'],
    });
  });
});

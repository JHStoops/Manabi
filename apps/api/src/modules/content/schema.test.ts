import type { Pool } from 'pg';
import { query, queryOne, withTransaction } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import {
  findItemByKey,
  insertCourse,
  insertItem,
  insertSentence,
  listItemsByCourse,
  setItemOverrides,
} from './queries';
import type { NewItem, NewSentence } from './queries';
import type { SentenceAttribution } from './rows';

// Integration tests for migration 0001 (content tables). Raw SQL here exercises constraints
// directly; application code keeps its SQL in queries.ts files.

const attribution: SentenceAttribution = {
  sentence: {
    sourceId: '4702',
    owner: 'someone',
    url: 'https://tatoeba.org/sentences/show/4702',
    licence: 'CC BY 2.0 FR',
    datasetVersion: '2026-10-01',
  },
  translation: {
    sourceId: '1276',
    owner: null,
    url: 'https://tatoeba.org/sentences/show/1276',
    licence: 'CC BY 2.0 FR',
    datasetVersion: '2026-10-01',
  },
};

async function seedCourse(pool: Pool): Promise<number> {
  const course = await insertCourse(pool, {
    key: 'ja-en',
    targetLang: 'ja',
    baseLang: 'en',
    plugin: 'ja',
    title: 'Japanese for English speakers',
  });
  return course.id;
}

function word(courseId: number, overrides: Partial<NewItem> = {}): NewItem {
  return {
    courseId,
    key: 'ja:word:水:みず',
    type: 'word',
    levelCode: 'N5',
    data: { reading: 'みず', meanings: ['water'] },
    source: 'jmdict',
    datasetVersion: '2026-10-01',
    ...overrides,
  };
}

function sentence(courseId: number, overrides: Partial<NewSentence> = {}): NewSentence {
  return {
    courseId,
    text: '水をください。',
    tokens: [
      { surface: '水', base: '水', reading: 'みず', itemId: null },
      { surface: 'を', base: 'を', reading: 'を' },
      { surface: 'ください', base: 'くださる', reading: 'ください' },
    ],
    translation: 'Water, please.',
    source: 'tatoeba',
    sourceId: '4702',
    attribution,
    grammar: ['ja:grammar:wo-kudasai'],
    vocabLevelCode: 'N5',
    grammarLevelCode: 'N5',
    ...overrides,
  };
}

describeWithDb('content schema (migration 0001)', () => {
  const pool = useTestDatabase();

  describe('items', () => {
    it('keeps imported values and author overrides in separate columns (DR-09)', async () => {
      const courseId = await seedCourse(pool());
      const created = await insertItem(pool(), word(courseId));
      expect(created).toMatchObject({
        key: 'ja:word:水:みず',
        overrides: {},
        source: 'jmdict',
        dataset_version: '2026-10-01',
        archived_at: null,
      });

      await setItemOverrides(pool(), 'ja:word:水:みず', { meanings: ['water', 'cold water'] });
      const item = await findItemByKey(pool(), 'ja:word:水:みず');
      expect(item!.data).toEqual({ reading: 'みず', meanings: ['water'] });
      expect(item!.overrides).toEqual({ meanings: ['water', 'cold water'] });
      expect(await listItemsByCourse(pool(), courseId)).toHaveLength(1);
    });

    it('rejects a duplicate key (DR-02)', async () => {
      const courseId = await seedCourse(pool());
      await insertItem(pool(), word(courseId));
      await expect(insertItem(pool(), word(courseId, { type: 'kanji' }))).rejects.toMatchObject({
        code: '23505',
        constraint: 'items_key_key',
      });
    });

    it('requires JSON objects for data and overrides, and a valid level code', async () => {
      const courseId = await seedCourse(pool());
      await expect(
        query(
          pool(),
          `INSERT INTO items (course_id, key, type, data) VALUES ($1, 'k', 'word', '[]')`,
          [courseId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(insertItem(pool(), word(courseId, { levelCode: 'N 5' }))).rejects.toMatchObject({
        code: '23514',
      });
      await expect(insertItem(pool(), word(courseId, { key: 'has space' }))).rejects.toMatchObject({
        code: '23514',
      });
      await expect(
        insertItem(pool(), word(courseId, { source: null, datasetVersion: '1' })),
      ).rejects.toMatchObject({ constraint: 'items_dataset_version_needs_source' });
    });

    it('rejects an item for an unknown course', async () => {
      await expect(insertItem(pool(), word(999))).rejects.toMatchObject({ code: '23503' });
    });
  });

  describe('sentences (DR-11, DR-12)', () => {
    it('stores tiles, attribution, review status, grammar and levels', async () => {
      const courseId = await seedCourse(pool());
      const row = await insertSentence(pool(), sentence(courseId));
      expect(row).toMatchObject({
        tokens: sentence(courseId).tokens,
        attribution,
        review_status: 'unreviewed',
        grammar: ['ja:grammar:wo-kudasai'],
        vocab_level_code: 'N5',
        grammar_level_code: 'N5',
        challenge_override: null,
        edited: false,
        translation_edited: false,
        tokens_edited: false,
      });
    });

    it('allows a null grammar level and an author challenge override', async () => {
      const courseId = await seedCourse(pool());
      const row = await insertSentence(
        pool(),
        sentence(courseId, { grammar: [], grammarLevelCode: null }),
      );
      expect(row.grammar_level_code).toBeNull();
      const updated = await queryOne<{ challenge_override: boolean }>(
        pool(),
        'UPDATE sentences SET challenge_override = true WHERE id = $1 RETURNING challenge_override',
        [row.id],
      );
      expect(updated!.challenge_override).toBe(true);
    });

    it('limits review status to unreviewed, flagged or reviewed', async () => {
      const courseId = await seedCourse(pool());
      const row = await insertSentence(pool(), sentence(courseId));
      for (const status of ['flagged', 'reviewed']) {
        await query(pool(), 'UPDATE sentences SET review_status = $2 WHERE id = $1', [
          row.id,
          status,
        ]);
      }
      await expect(
        query(pool(), `UPDATE sentences SET review_status = 'approved' WHERE id = $1`, [row.id]),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('requires attribution for imported sentences and allows authored ones without', async () => {
      const courseId = await seedCourse(pool());
      await expect(
        insertSentence(pool(), sentence(courseId, { attribution: null })),
      ).rejects.toMatchObject({ constraint: 'sentences_imported_have_attribution' });
      await expect(
        insertSentence(pool(), sentence(courseId, { sourceId: null })),
      ).rejects.toMatchObject({ constraint: 'sentences_source_pair' });
      const authored = await insertSentence(
        pool(),
        sentence(courseId, { source: null, sourceId: null, attribution: null }),
      );
      expect(authored.source).toBeNull();
    });

    it('keeps one row per course and source sentence id', async () => {
      const courseId = await seedCourse(pool());
      await insertSentence(pool(), sentence(courseId));
      await expect(insertSentence(pool(), sentence(courseId))).rejects.toMatchObject({
        constraint: 'sentences_course_source_key',
      });
    });
  });

  describe('course structure', () => {
    async function seedUnit(): Promise<{ courseId: number; unitId: number }> {
      const courseId = await seedCourse(pool());
      const section = await queryOne<{ id: number }>(
        pool(),
        `INSERT INTO sections (course_id, key, position, title, level_code)
         VALUES ($1, 'ja-en:n5', 0, 'N5', 'N5') RETURNING id`,
        [courseId],
      );
      const unit = await queryOne<{ id: number }>(
        pool(),
        `INSERT INTO units (section_id, key, position, title)
         VALUES ($1, 'ja-en:n5:food', 0, 'Food') RETURNING id`,
        [section!.id],
      );
      return { courseId, unitId: unit!.id };
    }

    const insertLesson = (unitId: number, key: string, position: number, type: string) =>
      query(
        pool(),
        `INSERT INTO lessons (unit_id, key, position, type, title) VALUES ($1, $2, $3, $4, 'L')`,
        [unitId, key, position, type],
      );

    it('accepts the six lesson types and rejects others (FR-040)', async () => {
      const { unitId } = await seedUnit();
      const types = ['kana', 'vocabulary', 'kanji', 'grammar', 'listening', 'unit_review'];
      for (const [i, type] of types.entries()) {
        await insertLesson(unitId, `l${i}`, i, type);
      }
      await expect(insertLesson(unitId, 'lx', 9, 'boss_fight')).rejects.toMatchObject({
        code: '23514',
      });
      const status = await queryOne<{ status: string }>(
        pool(),
        `SELECT status FROM lessons WHERE key = 'l0'`,
      );
      expect(status!.status).toBe('draft');
    });

    it('checks unique positions immediately, deferrable for a reorder transaction', async () => {
      const { unitId } = await seedUnit();
      await insertLesson(unitId, 'a', 0, 'kana');
      await insertLesson(unitId, 'b', 1, 'kana');
      await expect(insertLesson(unitId, 'c', 1, 'kana')).rejects.toMatchObject({
        constraint: 'lessons_unit_position_key',
      });
      // Without deferring, the first half of a swap fails straight away.
      await expect(
        withTransaction(pool(), (client) =>
          query(client, `UPDATE lessons SET position = 1 WHERE key = 'a'`),
        ),
      ).rejects.toMatchObject({ constraint: 'lessons_unit_position_key' });
      // A reorder defers the check to commit.
      await withTransaction(pool(), async (client) => {
        await query(client, 'SET CONSTRAINTS lessons_unit_position_key DEFERRED');
        await query(client, `UPDATE lessons SET position = 1 WHERE key = 'a'`);
        await query(client, `UPDATE lessons SET position = 0 WHERE key = 'b'`);
      });
      const order = await query<{ key: string }>(
        pool(),
        'SELECT key FROM lessons ORDER BY position',
      );
      expect(order.map((r) => r.key)).toEqual(['b', 'a']);
    });

    it('links lessons, items, sentences, exercises, strokes and audio', async () => {
      const { courseId, unitId } = await seedUnit();
      await insertLesson(unitId, 'l1', 0, 'kanji');
      const lesson = await queryOne<{ id: number }>(pool(), `SELECT id FROM lessons`);
      const kanji = await insertItem(
        pool(),
        word(courseId, { key: 'ja:kanji:水', type: 'kanji', data: { on: ['スイ'] } }),
      );
      const water = await insertItem(pool(), word(courseId));
      const s = await insertSentence(pool(), sentence(courseId));

      await query(pool(), `INSERT INTO lesson_items VALUES ($1, $2, 0)`, [lesson!.id, kanji.id]);
      await query(pool(), `INSERT INTO item_links VALUES ($1, $2, 'contains')`, [
        water.id,
        kanji.id,
      ]);
      await expect(
        query(pool(), `INSERT INTO item_links VALUES ($1, $1, 'contains')`, [kanji.id]),
      ).rejects.toMatchObject({ code: '23514' });
      await query(pool(), `INSERT INTO sentence_items VALUES ($1, $2)`, [s.id, water.id]);
      await query(pool(), `INSERT INTO stroke_data (item_id, strokes) VALUES ($1, $2)`, [
        kanji.id,
        { strokes: ['M 0 0'], medians: [[[0, 0]]] },
      ]);
      await query(
        pool(),
        `INSERT INTO exercises (lesson_id, type, payload, origin) VALUES ($1, 'word_bank', $2, 'authored')`,
        [lesson!.id, { answerTiles: [{ surface: '水', base: '水', reading: 'みず' }] }],
      );
      await expect(
        query(
          pool(),
          `INSERT INTO exercises (type, payload, origin) VALUES ('word_bank', '{}', 'authored')`,
        ),
      ).rejects.toMatchObject({ constraint: 'exercises_has_owner' });
      await expect(
        query(
          pool(),
          `INSERT INTO exercises (item_id, type, payload, origin) VALUES ($1, 'choice', '{}', 'copied')`,
          [water.id],
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await query(
        pool(),
        `INSERT INTO audio_assets (owner_type, owner_id, voice, path, origin, text_hash)
         VALUES ('item', $1, 'jf_alpha', 'audio/1.opus', 'generated', 'abc')`,
        [water.id],
      );
      await expect(
        query(
          pool(),
          `INSERT INTO audio_assets (owner_type, owner_id, voice, path, origin, text_hash)
           VALUES ('item', $1, 'jf_alpha', 'audio/2.opus', 'generated', 'def')`,
          [water.id],
        ),
      ).rejects.toMatchObject({ constraint: 'audio_assets_owner_voice_origin_key' });
      // Only an uploaded recording may omit the voice, and only once per owner.
      const audio = (path: string, origin: string) =>
        query(
          pool(),
          `INSERT INTO audio_assets (owner_type, owner_id, path, origin, text_hash)
           VALUES ('sentence', $1, $2, $3, 'abc')`,
          [s.id, path, origin],
        );
      await expect(audio('audio/3.opus', 'generated')).rejects.toMatchObject({
        constraint: 'audio_assets_voice_required',
      });
      await audio('audio/4.opus', 'uploaded');
      await expect(audio('audio/5.opus', 'uploaded')).rejects.toMatchObject({
        constraint: 'audio_assets_owner_voice_origin_key',
      });

      const counts = await queryOne<Record<string, number>>(
        pool(),
        `SELECT (SELECT count(*) FROM lesson_items) AS lesson_items,
                (SELECT count(*) FROM item_links) AS item_links,
                (SELECT count(*) FROM sentence_items) AS sentence_items,
                (SELECT count(*) FROM stroke_data) AS stroke_data,
                (SELECT count(*) FROM exercises) AS exercises,
                (SELECT count(*) FROM audio_assets) AS audio_assets`,
      );
      expect(counts).toEqual({
        lesson_items: 1,
        item_links: 1,
        sentence_items: 1,
        stroke_data: 1,
        exercises: 1,
        audio_assets: 2,
      });
    });
  });

  it('empties tables between tests', async () => {
    const row = await queryOne<{ n: number }>(pool(), 'SELECT count(*) AS n FROM courses');
    expect(row!.n).toBe(0);
  });
});

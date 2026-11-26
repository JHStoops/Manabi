import type { FastifyInstance } from 'fastify';
import type { LibraryItemDetail, LibraryItemPage } from '@manabi/core';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import { updateItemOverrides } from '../authoring/itemsService';
import { backfillLibraryFields } from './service';

// API tests for the library items API (issue #54): FR-075, FR-092, FR-102, NFR-01.

const PASSWORD = 'correct horse battery';
const kanji = (
  character: string,
  meaning: string,
  on: string,
  kun: string,
  strokes: number,
  radical: string,
) => ({
  character,
  meanings: [meaning],
  onReadings: [on],
  kunReadings: [kun],
  strokeCount: strokes,
  components: [radical],
});

describeWithDb('library API', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;
  let app: FastifyInstance;

  beforeEach(async () => {
    current = await testApp({ pool: pool() });
    app = current.app;
  });

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  function sql<R extends object = { id: number }>(text: string, params: unknown[] = []) {
    return query<R>(pool(), text, params);
  }

  /** A published ja course: three kanji, a word, a kana and a grammar point, plus sentences. */
  async function seed(status = 'published') {
    const [course] = await sql(
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('ja-en', 'ja', 'en', 'ja', 'Japanese', $1) RETURNING id`,
      [status],
    );
    const courseId = course!.id;
    await sql(
      `INSERT INTO sections (course_id, key, position, title, level_code)
       VALUES ($1, 'n5', 0, 'N5', 'N5'), ($1, 'n4', 1, 'N4', 'N4')`,
      [courseId],
    );
    const rows = await sql<{ id: number; key: string }>(
      `INSERT INTO items (course_id, key, type, level_code, data)
       SELECT $1, t.key, t.type, t.level, t.data::jsonb
         FROM unnest($2::text[], $3::text[], $4::text[], $5::text[]) AS t (key, type, level, data)
       RETURNING id, key`,
      [
        courseId,
        [
          'ja:kanji:水',
          'ja:kanji:火',
          'ja:kanji:語',
          'ja:word:水:みず',
          'ja:kana:あ',
          'ja:grammar:te-kudasai',
        ],
        ['kanji', 'kanji', 'kanji', 'word', 'kana', 'grammar'],
        ['N5', 'N5', 'N4', 'N5', 'kana', 'N5'],
        [
          kanji('水', 'water', 'スイ', 'みず', 4, '水'),
          kanji('火', 'fire', 'カ', 'ひ', 4, '火'),
          kanji('語', 'language', 'ゴ', 'かた.る', 14, '言'),
          {
            written: '水',
            reading: 'みず',
            senses: [{ partsOfSpeech: ['n'], meanings: ['water'] }],
          },
          { character: 'あ', script: 'hiragana', romaji: 'a' },
          { pattern: 'てください', meaning: 'please do' },
        ].map((d) => JSON.stringify(d)),
      ],
    );
    const id = Object.fromEntries(rows.map((r) => [r.key, r.id])) as Record<string, number>;
    await sql(
      `INSERT INTO item_links (from_item_id, to_item_id, kind) VALUES ($1, $2, 'contains')`,
      [id['ja:word:水:みず'], id['ja:kanji:水']],
    );
    // Four sentences with the word 水: reviewed, unreviewed and short, flagged, and challenging.
    const sentences = await sql(
      `INSERT INTO sentences (course_id, text, translation, review_status, vocab_level_code,
                              grammar_level_code, grammar)
       VALUES ($1, '水を飲みたいです。', 'I want to drink water.', 'reviewed', 'N5', 'N5', '[]'),
              ($1, '水です。', 'It is water.', 'unreviewed', 'N5', NULL, '["ja:grammar:te-kudasai"]'),
              ($1, '水だ。', 'Water.', 'flagged', 'N5', NULL, '[]'),
              ($1, '水をください。', 'Water, please.', 'reviewed', 'N5', 'N4', '[]')
       RETURNING id`,
      [courseId],
    );
    for (const s of sentences) {
      await sql(`INSERT INTO sentence_items (sentence_id, item_id) VALUES ($1, $2)`, [
        s.id,
        id['ja:word:水:みず'],
      ]);
    }
    await backfillLibraryFields(pool());
    return { courseId, id, sentences: sentences.map((s) => s.id) };
  }

  async function signIn(username: string, role: 'learner' | 'admin' = 'learner') {
    const user = await seedUser(pool(), {
      username,
      role,
      passwordHash: await hashPassword(PASSWORD),
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: username, password: PASSWORD },
    });
    const session = {
      cookies: { [SESSION_COOKIE]: login.cookies.find((c) => c.name === SESSION_COOKIE)!.value },
      headers: { origin: 'http://localhost:3000' },
    };
    return { userId: user.id, session };
  }

  async function progress(userId: number, itemId: number, facet: string, stage: number) {
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $4::smallint = 8 THEN NULL ELSE now() END)`,
      [userId, itemId, facet, stage],
    );
  }

  async function keys(session: object, courseId: number, params: string) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/items?courseId=${courseId}&${params}`,
      ...session,
    });
    expect(response.statusCode).toBe(200);
    return response.json<LibraryItemPage>().items.map((i) => i.key);
  }

  it('filters by type, level, stroke count and radical', async () => {
    const { courseId } = await seed();
    const { session } = await signIn('ann');
    expect(await keys(session, courseId, 'type=kanji')).toEqual([
      'ja:kanji:水',
      'ja:kanji:火',
      'ja:kanji:語',
    ]);
    expect(await keys(session, courseId, 'type=kanji&level=N4')).toEqual(['ja:kanji:語']);
    expect(await keys(session, courseId, 'strokeCount=4')).toEqual(['ja:kanji:水', 'ja:kanji:火']);
    expect(await keys(session, courseId, `radical=${encodeURIComponent('言')}`)).toEqual([
      'ja:kanji:語',
    ]);
  });

  it.each([
    ['English meaning, any case', 'WATER', ['ja:kanji:水', 'ja:word:水:みず']],
    ['hiragana finds a katakana on-reading', 'すい', ['ja:kanji:水']],
    ['kun reading', 'みず', ['ja:kanji:水', 'ja:word:水:みず']],
    ['character', '水', ['ja:kanji:水', 'ja:word:水:みず']],
    ['reading without the okurigana dot', 'かたる', ['ja:kanji:語']],
    [
      'romaji and meanings',
      'a',
      ['ja:kanji:水', 'ja:kanji:語', 'ja:word:水:みず', 'ja:kana:あ', 'ja:grammar:te-kudasai'],
    ],
    ['grammar pattern', 'ください', ['ja:grammar:te-kudasai']],
    ['grammar meaning', 'please', ['ja:grammar:te-kudasai']],
    ['LIKE wildcards literally', '%', []],
  ])('searches by %s', async (_name, q, expected) => {
    const { courseId } = await seed();
    const { session } = await signIn('ann');
    expect(await keys(session, courseId, `q=${encodeURIComponent(q)}`)).toEqual(expected);
  });

  it("shows and filters by the requesting learner's lowest facet stage", async () => {
    const { courseId, id } = await seed();
    const ann = await signIn('ann');
    const bob = await signIn('bob');
    await progress(ann.userId, id['ja:kanji:水']!, 'meaning', 6);
    await progress(ann.userId, id['ja:kanji:水']!, 'reading', 2);
    await progress(ann.userId, id['ja:kanji:火']!, 'reading', 7);
    await progress(bob.userId, id['ja:kanji:水']!, 'reading', 8);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/items?courseId=${courseId}&type=kanji`,
      ...ann.session,
    });
    expect(response.json<LibraryItemPage>().items.map((i) => i.stage)).toEqual([2, 7, null]);
    expect(await keys(ann.session, courseId, 'stage=learning')).toEqual(['ja:kanji:水']);
    expect(await keys(ann.session, courseId, 'stage=mastered')).toEqual(['ja:kanji:火']);
    expect(await keys(ann.session, courseId, 'stage=retired')).toEqual([]);
    expect(await keys(ann.session, courseId, 'type=kanji&stage=not_started')).toEqual([
      'ja:kanji:語',
    ]);
    expect(await keys(bob.session, courseId, 'stage=retired')).toEqual(['ja:kanji:水']);
    expect(await keys(bob.session, courseId, 'type=kanji&stage=not_started')).toEqual([
      'ja:kanji:火',
      'ja:kanji:語',
    ]);
  });

  it('pages with a cursor and rejects a bad one', async () => {
    const { courseId } = await seed();
    const { session } = await signIn('ann');
    const get = (params: string) =>
      app.inject({
        method: 'GET',
        url: `/api/v1/items?courseId=${courseId}&${params}`,
        ...session,
      });
    const first = (await get('limit=4')).json<LibraryItemPage>();
    expect(first.items).toHaveLength(4);
    const second = (await get(`limit=4&cursor=${first.nextCursor}`)).json<LibraryItemPage>();
    expect(second.items.map((i) => i.key)).toEqual(['ja:kana:あ', 'ja:grammar:te-kudasai']);
    expect(second.nextCursor).toBeNull();
    expect((await get('cursor=bm9wZQ')).statusCode).toBe(400);
  });

  it('hides draft courses from learners but not admins', async () => {
    const { courseId } = await seed('draft');
    const ann = await signIn('ann');
    const admin = await signIn('root', 'admin');
    const list = (session: object) =>
      app.inject({ method: 'GET', url: `/api/v1/items?courseId=${courseId}`, ...session });
    expect((await list(ann.session)).statusCode).toBe(404);
    expect((await list(admin.session)).statusCode).toBe(200);
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/items/${encodeURIComponent('ja:kanji:水')}`,
      ...ann.session,
    });
    expect(detail.statusCode).toBe(404);
  });

  it('returns item detail with facets, links and up to 5 example sentences', async () => {
    const { id, sentences } = await seed();
    const ann = await signIn('ann');
    await progress(ann.userId, id['ja:kanji:水']!, 'reading', 2);
    await progress(ann.userId, id['ja:word:水:みず']!, 'meaning', 5);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/items/${encodeURIComponent('ja:kanji:水')}`,
      ...ann.session,
    });
    expect(response.statusCode).toBe(200);
    const detail = response.json<LibraryItemDetail>();
    expect(detail).toMatchObject({ key: 'ja:kanji:水', stage: 2, data: { meanings: ['water'] } });
    expect(detail.facets).toEqual([{ facet: 'reading', stage: 2, dueAt: expect.any(String) }]);
    expect(detail.links).toEqual([
      expect.objectContaining({
        kind: 'contains',
        direction: 'incoming',
        item: expect.objectContaining({ key: 'ja:word:水:みず', stage: 5 }),
      }),
    ]);
    // Via the word: reviewed first, then shortest; flagged and challenging ones left out.
    expect(detail.sentences.map((s) => s.id)).toEqual([sentences[0], sentences[1]]);

    const grammar = await app.inject({
      method: 'GET',
      url: `/api/v1/items/${encodeURIComponent('ja:grammar:te-kudasai')}`,
      ...ann.session,
    });
    expect(grammar.json<LibraryItemDetail>().sentences.map((s) => s.id)).toEqual([sentences[1]]);

    const missing = await app.inject({ method: 'GET', url: '/api/v1/items/nope', ...ann.session });
    expect(missing.statusCode).toBe(404);
  });

  it('searches the merged data after an author override', async () => {
    const { courseId, id } = await seed();
    const { session } = await signIn('ann');
    await updateItemOverrides(pool(), id['ja:kanji:火']!, { meanings: ['flame'] });
    expect(await keys(session, courseId, 'q=flame')).toEqual(['ja:kanji:火']);
    expect(await keys(session, courseId, 'q=fire')).toEqual([]);
  });

  it('uses indexes for search and filters on a 5,000-item course', async () => {
    const { courseId } = await seed();
    await sql(
      `INSERT INTO items (course_id, key, type, level_code, data)
       SELECT $1, 'k' || n, 'kanji', 'N3',
              jsonb_build_object('character', chr(19968 + n), 'meanings', jsonb_build_array('m' || n),
                'onReadings', '[]'::jsonb, 'kunReadings', '[]'::jsonb,
                'strokeCount', 1 + n % 30, 'components', jsonb_build_array(chr(20000 + n % 200)))
         FROM generate_series(1, 5000) AS n`,
      [courseId],
    );
    await backfillLibraryFields(pool());
    // VACUUM also flushes the GIN pending list the bulk update left, as autovacuum would.
    await sql('VACUUM ANALYZE items');
    // At 5,000 short rows a sequential scan can still be the cheaper plan, so sequential scans are
    // priced out to show each predicate is served by its index.
    const client = await pool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const plan = async (where: string, params: unknown[]) =>
        (
          await client.query<{ 'QUERY PLAN': string }>(
            `EXPLAIN SELECT id FROM items WHERE course_id = $1 AND ${where}`,
            [courseId, ...params],
          )
        ).rows
          .map((r) => r['QUERY PLAN'])
          .join('\n');
      expect(await plan(`search_text LIKE $2`, ['%m4321%'])).toContain('items_search_trgm_idx');
      expect(await plan(`stroke_count = $2`, [7])).toContain('items_course_stroke_count_idx');
      expect(await plan(`radical = $2`, ['言'])).toContain('items_course_radical_idx');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

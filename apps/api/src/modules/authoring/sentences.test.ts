import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import { findCourseByKey } from '../content/queries';
import { readPack } from '../content/packFiles';
import { exportPack, importPack } from '../content/service';
import { upsertLevelListWords } from '../imports/queries';
import { importTatoeba } from '../imports/service';
import { updateItemOverrides } from './itemsService';

// API tests for /authoring/sentences (#62): FR-059, FR-236, FR-237, FR-238, DR-11, FR-006.

const PASSWORD = 'correct horse battery';
const ORIGIN = 'http://localhost:3000';
const PACK = join(__dirname, '../../../../../content/ja-en');
const TATOEBA = join(__dirname, '../../../../../packages/importers/fixtures/tatoeba-grammar');

describeWithDb('sentence editor API', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  async function as(role: 'admin' | 'learner') {
    current = await testApp({ pool: pool(), env: {} });
    const app: FastifyInstance = current.app;
    await seedUser(pool(), { username: role, role, passwordHash: await hashPassword(PASSWORD) });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: role, password: PASSWORD },
    });
    const cookie = login.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
    return (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
      app.inject({
        method,
        url: `/api/v1/authoring/sentences${url}`,
        cookies: { [SESSION_COOKIE]: cookie },
        headers: { origin: ORIGIN },
        ...(payload ? { payload } : {}),
      });
  }

  const importSentences = () => importTatoeba(pool(), { courseKey: 'ja-en', file: TATOEBA });

  /** The ja-en grammar points and N5 words for two Tatoeba sentences, imported unreviewed. */
  async function seed() {
    const pack = await readPack(PACK);
    const items = pack.items.filter((item) => item.type === 'grammar');
    await importPack(pool(), { ...pack, units: [], sentences: [], items });
    const course = (await findCourseByKey(pool(), 'ja-en'))!;
    const words = [
      ['この', 'この'],
      ['家', 'いえ'],
      ['まま', 'まま'],
      ['する', 'する'],
      ['置く', 'おく'],
      ['これ', 'これ'],
      ['私', 'わたし'],
      ['猫', 'ねこ'],
    ].map(([written, reading]) => ({ level: 'N5', written: written!, reading: reading! }));
    await upsertLevelListWords(pool(), { courseId: course.id, words });
    await importSentences();
    const id = async (sourceId: string) =>
      (await queryOne<{ id: number }>(pool(), `SELECT id FROM sentences WHERE source_id = $1`, [
        sourceId,
      ]))!.id;
    // この家はこのままにしておきたい。 (ておく, N4) and これは私の猫です。 (no point).
    return { courseId: course.id, house: await id('222833'), cat: await id('757782') };
  }

  it('is for admins only (FR-006)', async () => {
    const learner = await as('learner');
    expect((await learner('GET', '?course=1')).statusCode).toBe(403);
    expect((await learner('PATCH', '/1', { reviewStatus: 'reviewed' })).statusCode).toBe(403);
  });

  it('lists a grammar point’s sentences and shows grammar level and challenge status (FR-059)', async () => {
    const { courseId, house } = await seed();
    const admin = await as('admin');

    const list = await admin('GET', `?course=${courseId}&grammar=ja:grammar:te-oku`);
    expect(list.statusCode).toBe(200);
    expect(list.json().sentences).toEqual([
      expect.objectContaining({ id: house, grammarLevelCode: 'N4', challenging: true }),
    ]);
    const reviewed = await admin('GET', `?course=${courseId}&status=reviewed`);
    expect(reviewed.json().sentences).toEqual([]);

    const one = (await admin('GET', `/${house}`)).json();
    expect(one).toMatchObject({
      challenging: true,
      blockedWords: [],
      sentence: {
        grammar: ['ja:grammar:te-oku'],
        vocabLevelCode: 'N5',
        grammarLevelCode: 'N4',
        challengeOverride: null,
        reviewStatus: 'unreviewed',
        source: 'tatoeba',
        attribution: { sentence: { sourceId: '222833' } },
      },
    });
    expect((await admin('GET', '/999999')).statusCode).toBe(404);
  });

  it('sets, keeps on re-import and clears the challenge override (FR-059, FR-236)', async () => {
    const { house } = await seed();
    const admin = await as('admin');

    const set = await admin('PATCH', `/${house}`, { challengeOverride: false });
    expect(set.statusCode).toBe(200);
    expect(set.json()).toMatchObject({
      challenging: false,
      sentence: { challengeOverride: false },
    });

    await importSentences();
    expect((await admin('GET', `/${house}`)).json()).toMatchObject({
      challenging: false,
      sentence: { challengeOverride: false },
    });

    // FR-236: moving the point to N5 makes its sentences' grammar level N5, so not challenging.
    const point = await queryOne<{ id: number }>(
      pool(),
      `SELECT id FROM items WHERE key = 'ja:grammar:te-oku'`,
    );
    await updateItemOverrides(pool(), point!.id, { overrides: {}, level: 'N5' });
    expect((await admin('GET', `/${house}`)).json()).toMatchObject({
      challenging: false,
      sentence: { grammarLevelCode: 'N5' },
    });
    await updateItemOverrides(pool(), point!.id, { overrides: {}, level: 'N4' });

    const cleared = await admin('PATCH', `/${house}`, { challengeOverride: null });
    expect(cleared.json()).toMatchObject({
      challenging: true,
      sentence: { challengeOverride: null },
    });
  });

  it('validates tiles, and saves split, merged and pattern-marked tiles (FR-238)', async () => {
    const { cat } = await seed();
    const admin = await as('admin');
    const { tokens } = (await admin('GET', `/${cat}`)).json().sentence;
    expect(tokens.map((t: { surface: string }) => t.surface)).toEqual([
      'これ',
      'は',
      '私',
      'の',
      '猫',
      'です',
    ]);

    const wrong = await admin('PATCH', `/${cat}`, {
      tiles: [{ surface: '犬', base: '犬', reading: 'いぬ' }],
    });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error.details[0].path).toEqual(['tiles', 0, 'surface']);
    const outOfOrder = await admin('PATCH', `/${cat}`, { tiles: [tokens[1], tokens[0]] });
    expect(outOfOrder.statusCode).toBe(400);
    const unknownItem = await admin('PATCH', `/${cat}`, {
      tiles: [{ ...tokens[0], itemId: 999999 }],
    });
    expect(unknownItem.statusCode).toBe(400);
    const both = await admin('PATCH', `/${cat}`, { tiles: tokens, resegment: true });
    expect(both.statusCode).toBe(400);
    // Tiles must cover every word; only punctuation may be left between or after them.
    const short = await admin('PATCH', `/${cat}`, { tiles: tokens.slice(0, 5) });
    expect(short.statusCode).toBe(400);
    const gap = await admin('PATCH', `/${cat}`, { tiles: [tokens[0], ...tokens.slice(2)] });
    expect(gap.statusCode).toBe(400);

    // Saving the stored tiles unchanged (the editor always sends them) is not a tile edit.
    const same = await admin('PATCH', `/${cat}`, { tiles: tokens, reviewStatus: 'flagged' });
    expect(same.json().sentence).toMatchObject({ tokensEdited: false, reviewStatus: 'flagged' });

    // Merge これ + は, mark です as the pattern, correct a reading.
    const tiles = [
      { surface: 'これは', base: 'これは', reading: 'これは' },
      ...tokens.slice(2, 5),
      { ...tokens[5], pattern: true },
    ];
    tiles[2] = { ...tiles[2], reading: 'ノ' };
    const saved = await admin('PATCH', `/${cat}`, { tiles, reviewStatus: 'reviewed' });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().sentence).toMatchObject({
      tokens: tiles,
      // Tile fixes that change no item link keep the imported vocabulary level (FR-236).
      vocabLevelCode: 'N5',
      tokensEdited: true,
      edited: false,
      reviewStatus: 'reviewed',
    });

    // Linking a tile to an item re-levels the sentence from its linked items.
    const { id: catItem } = (await queryOne<{ id: number }>(
      pool(),
      `INSERT INTO items (course_id, key, type, level_code, data)
       SELECT course_id, 'ja:word:猫:ねこ', 'word', 'N4', '{}' FROM sentences WHERE id = $1
       RETURNING id`,
      [cat],
    ))!;
    const linkedTiles = tiles.map((t, i) => (i === 3 ? { ...t, itemId: catItem } : t));
    const linked = await admin('PATCH', `/${cat}`, { tiles: linkedTiles });
    expect(linked.json().sentence).toMatchObject({ vocabLevelCode: 'N4', grammarLevelCode: null });
    // With no linked item left the level stays: imported tiles carry no links at all.
    const restored = await admin('PATCH', `/${cat}`, { tiles });
    expect(restored.json().sentence.vocabLevelCode).toBe('N4');

    // Re-import keeps the author's tiles; export carries the pattern mark.
    await importSentences();
    expect((await admin('GET', `/${cat}`)).json().sentence.tokens).toEqual(tiles);
    const exported = (await exportPack(pool(), 'ja-en')).sentences.find(
      (s) => s.sourceId === '757782',
    );
    expect(exported?.tiles.at(-1)).toEqual({
      surface: 'です',
      base: 'です',
      reading: 'です',
      pattern: true,
    });
  });

  it('re-segments edited text, re-detects grammar and sets the edited flags (FR-236, DR-11)', async () => {
    const { house } = await seed();
    const admin = await as('admin');
    const text = 'この家はこのままにしたい。';

    // The old tiles no longer match the new text, so the author must re-segment.
    expect((await admin('PATCH', `/${house}`, { text })).statusCode).toBe(400);

    const res = await admin('PATCH', `/${house}`, { text, resegment: true });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      challenging: false,
      sentence: {
        text,
        grammar: [],
        grammarLevelCode: null,
        vocabLevelCode: 'N5',
        edited: true,
        tokensEdited: true,
      },
    });
    expect(
      res
        .json()
        .sentence.tokens.map((t: { surface: string }) => t.surface)
        .join(''),
    ).toBe('この家はこのままにしたい');

    const translated = await admin('PATCH', `/${house}`, { translation: 'I want to keep it.' });
    expect(translated.json().sentence).toMatchObject({ translationEdited: true });

    await importSentences();
    expect((await admin('GET', `/${house}`)).json().sentence).toMatchObject({
      text,
      translation: 'I want to keep it.',
    });
  });

  it('creates an authored sentence with tiles, grammar and blocked-word warnings (FR-237, FR-238)', async () => {
    const { courseId } = await seed();
    await query(pool(), `INSERT INTO blocked_words (lang, word) VALUES ('ja', '家')`);
    const admin = await as('admin');

    const res = await admin('POST', '', {
      course: courseId,
      text: 'この家はこのままにしておきたい。',
      translation: 'I want to leave this house as it is.',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      blockedWords: ['家'],
      challenging: true,
      sentence: {
        source: null,
        grammar: ['ja:grammar:te-oku'],
        grammarLevelCode: 'N4',
        edited: false,
      },
    });
    expect(res.json().sentence.tokens.length).toBeGreaterThan(3);

    // An edit that keeps the blocked word still warns.
    const id = res.json().sentence.id;
    const edited = await admin('PATCH', `/${id}`, { reviewStatus: 'flagged' });
    expect(edited.json()).toMatchObject({ blockedWords: ['家'], sentence: { edited: false } });
    expect(
      (await admin('POST', '', { course: 999999, text: 'a', translation: 'b' })).statusCode,
    ).toBe(404);
  });
});

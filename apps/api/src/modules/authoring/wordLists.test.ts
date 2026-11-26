import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import { readPack } from '../content/packFiles';
import { exportPack, importPack } from '../content/service';
import { upsertLevelListWords } from '../imports/queries';
import { importTatoeba } from '../imports/service';

// API tests for /authoring/word-lists (#118): FR-234, FR-237, FR-006.

const PASSWORD = 'correct horse battery';
const ORIGIN = 'http://localhost:3000';
const FIXTURE = join(__dirname, '../../test/fixtures/ja-en');
const TATOEBA = join(__dirname, '../../../../../packages/importers/fixtures/tatoeba');

describeWithDb('word lists API', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  /** A request helper signed in as a new user of this role. */
  async function as(role: 'admin' | 'learner') {
    current = await testApp({ pool: pool(), env: {} });
    const app: FastifyInstance = current.app;
    await seedUser(pool(), {
      username: role,
      role,
      passwordHash: await hashPassword(PASSWORD),
    });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: role, password: PASSWORD },
    });
    const cookie = login.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
    return (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
      app.inject({
        method,
        url: `/api/v1/authoring/word-lists${url}`,
        cookies: { [SESSION_COOKIE]: cookie },
        headers: { origin: ORIGIN },
        ...(payload ? { payload } : {}),
      });
  }

  it('is for admins only (FR-006)', async () => {
    const learner = await as('learner');
    for (const [method, url] of [
      ['GET', '/supplementary-words'],
      ['POST', '/supplementary-words'],
      ['PATCH', '/supplementary-words/1'],
      ['DELETE', '/supplementary-words/1'],
      ['GET', '/blocked-words'],
      ['POST', '/blocked-words'],
      ['DELETE', '/blocked-words/1'],
    ] as const) {
      expect((await learner(method, url, method === 'GET' ? undefined : {})).statusCode).toBe(403);
    }
  });

  describe('supplementary words (FR-234)', () => {
    it('lists, adds, edits and removes them, filtered by level', async () => {
      await importPack(pool(), await readPack(FIXTURE));
      await query(pool(), `DELETE FROM supplementary_words`);
      const admin = await as('admin');

      const added = await admin('POST', '/supplementary-words', {
        course: 'ja-en',
        level: 'N5',
        written: '先生',
        reading: 'せんせい',
        note: 'teacher',
      });
      expect(added.statusCode).toBe(201);
      const word = added.json();
      expect(word).toEqual({
        id: expect.any(Number),
        course: 'ja-en',
        level: 'N5',
        written: '先生',
        reading: 'せんせい',
        note: 'teacher',
      });

      // Duplicates, unknown courses and levels without a section are rejected.
      const base = { course: 'ja-en', level: 'N5', written: '先生', reading: 'せんせい' };
      expect((await admin('POST', '/supplementary-words', base)).statusCode).toBe(409);
      expect(
        (await admin('POST', '/supplementary-words', { ...base, level: 'N1' })).statusCode,
      ).toBe(404);
      expect(
        (await admin('POST', '/supplementary-words', { ...base, course: 'x' })).statusCode,
      ).toBe(404);
      expect(
        (await admin('POST', '/supplementary-words', { ...base, written: '' })).statusCode,
      ).toBe(400);

      const listed = async (suffix = '') =>
        (await admin('GET', `/supplementary-words${suffix}`)).json().words;
      expect(await listed()).toEqual([word]);
      expect(await listed('?level=N4')).toEqual([]);
      expect(await listed('?level=N5&course=ja-en')).toEqual([word]);

      const edited = await admin('PATCH', `/supplementary-words/${word.id}`, {
        reading: 'せんせえ',
        note: null,
      });
      expect(edited.json()).toEqual({ ...word, reading: 'せんせえ', note: null });
      expect((await listed())[0]).toEqual({ ...word, reading: 'せんせえ', note: null });
      expect((await admin('PATCH', `/supplementary-words/${word.id}`, {})).statusCode).toBe(400);
      expect(
        (await admin('PATCH', `/supplementary-words/${word.id}`, { level: 'N1' })).statusCode,
      ).toBe(404);
      expect((await admin('PATCH', '/supplementary-words/999999', { note: 'x' })).statusCode).toBe(
        404,
      );

      expect((await admin('DELETE', `/supplementary-words/${word.id}`)).statusCode).toBe(204);
      expect(await listed()).toEqual([]);
      expect((await admin('DELETE', `/supplementary-words/${word.id}`)).statusCode).toBe(404);
    });

    it('edits reach the next import and the pack export', async () => {
      await importPack(pool(), await readPack(FIXTURE));
      await query(pool(), `DELETE FROM supplementary_words`);
      const admin = await as('admin');
      // The fixture course has the N5 section; give the Tatoeba fixture its level-list words.
      const courseId = (await query<{ id: number }>(pool(), `SELECT id FROM courses`))[0]!.id;
      await upsertLevelListWords(pool(), {
        courseId,
        words: [{ level: 'N5', written: '私', reading: 'わたし' }],
      });

      // 私は先生です。 is blocked only by 先生, which the level lists lack.
      const sentence = () =>
        query(pool(), `SELECT 1 FROM sentences WHERE source = 'tatoeba' AND source_id = '155469'`);
      await importTatoeba(pool(), { courseKey: 'ja-en', file: TATOEBA });
      expect(await sentence()).toHaveLength(0);

      await admin('POST', '/supplementary-words', {
        course: 'ja-en',
        level: 'N5',
        written: '先生',
        reading: 'せんせい',
      });
      await importTatoeba(pool(), { courseKey: 'ja-en', file: TATOEBA });
      expect(await sentence()).toHaveLength(1);
      expect((await exportPack(pool(), 'ja-en')).supplementaryWords).toEqual([
        { level: 'N5', written: '先生', reading: 'せんせい' },
      ]);
    });
  });

  describe('blocked words (FR-237)', () => {
    it('lists, adds and removes them, and the export has them', async () => {
      await importPack(pool(), await readPack(FIXTURE));
      await query(pool(), `DELETE FROM blocked_words`);
      const admin = await as('admin');

      const added = await admin('POST', '/blocked-words', { lang: 'ja', word: '馬鹿' });
      expect(added.statusCode).toBe(201);
      const word = added.json();
      expect(word).toEqual({ id: expect.any(Number), lang: 'ja', word: '馬鹿' });
      expect((await admin('POST', '/blocked-words', { lang: 'ja', word: '馬鹿' })).statusCode).toBe(
        409,
      );
      expect((await admin('POST', '/blocked-words', { lang: 'JA', word: 'x' })).statusCode).toBe(
        400,
      );
      await admin('POST', '/blocked-words', { lang: 'fr', word: 'zut' });

      expect((await admin('GET', '/blocked-words')).json().words).toHaveLength(2);
      expect((await admin('GET', '/blocked-words?lang=ja')).json().words).toEqual([word]);
      expect((await exportPack(pool(), 'ja-en')).blockedWords).toEqual(['馬鹿']);

      expect((await admin('DELETE', `/blocked-words/${word.id}`)).statusCode).toBe(204);
      expect((await admin('GET', '/blocked-words?lang=ja')).json().words).toEqual([]);
      expect((await admin('DELETE', `/blocked-words/${word.id}`)).statusCode).toBe(404);
      expect((await exportPack(pool(), 'ja-en')).blockedWords).toEqual([]);
    });
  });
});

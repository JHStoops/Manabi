import type { FastifyInstance } from 'fastify';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';

// API test for GET /media/strokes/:itemKey (issue #51): FR-071, FR-077.

const PASSWORD = 'correct horse battery';
const WATER = {
  strokes: ['M 0 0 L 1 1 Z'],
  medians: [
    [
      [0, 0],
      [10, 10],
    ],
  ],
};

describeWithDb('media API', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;
  let app: FastifyInstance;

  beforeEach(async () => {
    current = await testApp({ pool: pool() });
    app = current.app;
    await query(
      pool(),
      `WITH c AS (
         INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
         VALUES ('ja-en', 'ja', 'en', 'ja', 'Japanese', 'published') RETURNING id
       ), i AS (
         INSERT INTO items (course_id, key, type)
         SELECT id, v.key, 'kanji' FROM c, (VALUES ('ja:kanji:水'), ('ja:kanji:火')) AS v (key)
         RETURNING id, key
       )
       INSERT INTO stroke_data (item_id, strokes) SELECT id, $1 FROM i WHERE key = 'ja:kanji:水'`,
      [WATER],
    );
  });

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  async function signedIn() {
    await seedUser(pool(), { username: 'learner', passwordHash: await hashPassword(PASSWORD) });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'learner', password: PASSWORD },
    });
    return { [SESSION_COOKIE]: response.cookies.find((c) => c.name === SESSION_COOKIE)!.value };
  }

  const strokes = (key: string) => `/api/v1/media/strokes/${encodeURIComponent(key)}`;

  it("serves an item's stroke data by its key", async () => {
    const response = await app.inject({ url: strokes('ja:kanji:水'), cookies: await signedIn() });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(WATER);
  });

  it('answers 404 for an item without stroke data or an unknown key', async () => {
    const cookies = await signedIn();
    for (const key of ['ja:kanji:火', 'ja:kanji:木']) {
      const response = await app.inject({ url: strokes(key), cookies });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('not_found');
    }
  });

  it('requires a signed-in user', async () => {
    const response = await app.inject({ url: strokes('ja:kanji:水') });
    expect(response.statusCode).toBe(401);
  });
});

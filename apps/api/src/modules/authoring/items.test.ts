import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import { readPack } from '../content/packFiles';
import { importPack } from '../content/service';
import { importKanjidic2 } from '../imports/service';

// API tests for /authoring/items (#42): FR-221, DR-06, DR-09, FR-006.

const PASSWORD = 'correct horse battery';
const ORIGIN = 'http://localhost:3000';
const FIXTURE = join(__dirname, '../../test/fixtures/ja-en');
const KANJIDIC2 = join(__dirname, '../../../../../packages/importers/fixtures/kanjidic2.xml');

describeWithDb('item editor API', () => {
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
    return (method: 'GET' | 'PATCH', url: string, payload?: object) =>
      app.inject({
        method,
        url: `/api/v1/authoring/items${url}`,
        cookies: { [SESSION_COOKIE]: cookie },
        headers: { origin: ORIGIN },
        ...(payload ? { payload } : {}),
      });
  }

  /** The course structure and the KANJIDIC2 fixture's kanji, as on a fresh server. */
  async function seed(): Promise<{ courseId: number; waterId: number }> {
    await importPack(pool(), await readPack(FIXTURE), true);
    await importKanjidic2(pool(), { courseKey: 'ja-en', file: KANJIDIC2 });
    const row = await queryOne<{ id: number; course_id: number }>(
      pool(),
      `SELECT id, course_id FROM items WHERE key = 'ja:kanji:水'`,
    );
    return { courseId: row!.course_id, waterId: row!.id };
  }

  it('is for admins only (FR-006)', async () => {
    const learner = await as('learner');
    expect((await learner('GET', '?course=1')).statusCode).toBe(403);
    expect((await learner('GET', '/1')).statusCode).toBe(403);
    expect((await learner('PATCH', '/1', { overrides: {} })).statusCode).toBe(403);
  });

  it('finds items by key and shows data, overrides, the merged view and form fields', async () => {
    const { courseId, waterId } = await seed();
    const admin = await as('admin');

    const list = await admin('GET', `?course=${courseId}&type=kanji&q=${encodeURIComponent('水')}`);
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toEqual([
      expect.objectContaining({ id: waterId, key: 'ja:kanji:水', overridden: false }),
    ]);

    const item = (await admin('GET', `/${waterId}`)).json();
    expect(item).toMatchObject({ source: 'kanjidic2', overrides: {} });
    expect(item.effective).toEqual(item.data);
    expect(item.fields).toContainEqual({ name: 'meanings', kind: 'textList', optional: false });
    expect((await admin('GET', '/999999')).statusCode).toBe(404);
  });

  it('keeps an override when the importer runs again (FR-221, DR-09)', async () => {
    const { courseId, waterId } = await seed();
    const admin = await as('admin');

    const saved = await admin('PATCH', `/${waterId}`, {
      overrides: { meanings: ['water', 'aqua'] },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().effective.meanings).toEqual(['water', 'aqua']);
    const imported = saved.json().data;

    // An older import left different data; re-running the importer rewrites `data` only.
    await query(pool(), `UPDATE items SET data = data || '{"strokeCount": 9}' WHERE id = $1`, [
      waterId,
    ]);
    await importKanjidic2(pool(), { courseKey: 'ja-en', file: KANJIDIC2 });

    const after = (await admin('GET', `/${waterId}`)).json();
    expect(after.data).toEqual(imported);
    expect(after.overrides).toEqual({ meanings: ['water', 'aqua'] });
    expect(after.effective.meanings).toEqual(['water', 'aqua']);
    const list = await admin('GET', `?course=${courseId}&q=${encodeURIComponent('水')}`);
    expect(list.json().items).toContainEqual(expect.objectContaining({ overridden: true }));

    // Clearing: overrides without the field bring the imported value back.
    const cleared = (await admin('PATCH', `/${waterId}`, { overrides: {} })).json();
    expect(cleared.effective).toEqual(imported);
  });

  it('rejects overrides that fail the language schema, with field paths (DR-06)', async () => {
    const { waterId } = await seed();
    const admin = await as('admin');

    const res = await admin('PATCH', `/${waterId}`, {
      overrides: { strokeCount: 0, meanings: [''], colour: 'blue' },
    });
    expect(res.statusCode).toBe(400);
    const { code, details } = res.json().error;
    expect(code).toBe('validation_failed');
    const paths = details.map((d: { path: unknown[] }) => d.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining(['overrides.strokeCount', 'overrides.meanings.0', 'overrides']),
    );
    expect((await admin('GET', `/${waterId}`)).json().overrides).toEqual({});
  });
});

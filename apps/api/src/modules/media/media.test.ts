import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { TtsProvider, TtsRequest } from '@manabi/core';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import { wav } from '../../test/audio';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import { kokoroProvider } from './kokoro';

// Issue #65: FR-131, FR-136, IF-09, NFR-07, NFR-23. Needs ffmpeg and ffprobe on the PATH.

const PASSWORD = 'correct horse battery';
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** A fake engine that records what it was sent and answers after a tick. */
function fakeTts() {
  const calls: TtsRequest[] = [];
  const provider: TtsProvider = {
    synthesize: async (req) => {
      calls.push(req);
      await new Promise((r) => setTimeout(r, 20));
      return wav();
    },
  };
  return { calls, provider };
}

describeWithDb('media audio API', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;
  let mediaDir: string;

  beforeEach(async () => {
    mediaDir = await mkdtemp(join(tmpdir(), 'manabi-media-'));
  });

  afterEach(async () => {
    await current?.close();
    current = undefined;
    await rm(mediaDir, { recursive: true, force: true });
  });

  async function start(tts: TtsProvider) {
    current = await testApp({
      pool: pool(),
      env: { MEDIA_DIR: mediaDir },
      tts,
    });
    await seedUser(pool(), { username: 'amy', passwordHash: await hashPassword(PASSWORD) });
    const login = await current.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'amy', password: PASSWORD },
    });
    const cookie = login.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
    return (url: string) => current!.app.inject({ url, cookies: { [SESSION_COOKIE]: cookie } });
  }

  async function seedWord(written: string, reading: string): Promise<number> {
    const courseId = await seedCourse(pool());
    const [row] = await query<{ id: number }>(
      pool(),
      `INSERT INTO items (course_id, key, type, data) VALUES ($1, 'ja:word:mizu', 'word', $2)
       RETURNING id`,
      [courseId, JSON.stringify({ written, reading })],
    );
    return row!.id;
  }

  const assets = () =>
    query<{ origin: string; path: string; text_hash: string }>(
      pool(),
      `SELECT origin, path, text_hash FROM audio_assets ORDER BY id`,
    );

  it('generates and stores a clip on first play, then serves the cached file (FR-131)', async () => {
    const tts = fakeTts();
    const get = await start(tts.provider);
    const id = await seedWord('水', 'みず');

    const first = await get(`/api/v1/media/audio/item/${id}`);
    expect(first.statusCode).toBe(200);
    expect(first.headers['content-type']).toBe('audio/ogg');
    expect(first.rawPayload.subarray(0, 4).toString()).toBe('OggS');
    expect(await assets()).toEqual([
      { origin: 'generated', path: `audio/item/${id}-jf_alpha.opus`, text_hash: sha256('みず') },
    ]);
    expect(await readFile(join(mediaDir, `audio/item/${id}-jf_alpha.opus`))).toEqual(
      first.rawPayload,
    );

    const second = await get(`/api/v1/media/audio/item/${id}`);
    expect(second.statusCode).toBe(200);
    expect(second.rawPayload).toEqual(first.rawPayload);
    expect(tts.calls).toHaveLength(1);
  });

  it('sends the engine the kana reading, never the written form (FR-136)', async () => {
    const tts = fakeTts();
    const get = await start(tts.provider);
    const itemId = await seedWord('水', 'みず');
    const [sentence] = await query<{ id: number }>(
      pool(),
      `INSERT INTO sentences (course_id, text, tokens, translation)
       SELECT course_id, '水を飲みます', $1, 'I drink water.' FROM items WHERE id = $2
       RETURNING id`,
      [
        JSON.stringify([
          { surface: '水', base: '水', reading: 'みず' },
          { surface: 'を', base: 'を', reading: 'を' },
          { surface: '飲みます', base: '飲む', reading: 'のみます' },
        ]),
        itemId,
      ],
    );

    expect((await get(`/api/v1/media/audio/item/${itemId}`)).statusCode).toBe(200);
    expect((await get(`/api/v1/media/audio/sentence/${sentence!.id}`)).statusCode).toBe(200);
    expect(tts.calls).toEqual([
      { text: '水', reading: 'みず', voice: 'jf_alpha', language: 'j' },
      { text: '水を飲みます', reading: 'みずをのみます', voice: 'jf_alpha', language: 'j' },
    ]);
  });

  it('regenerates when the reading changes', async () => {
    const tts = fakeTts();
    const get = await start(tts.provider);
    const id = await seedWord('上手', 'うわて');
    await get(`/api/v1/media/audio/item/${id}`);
    await query(pool(), `UPDATE items SET overrides = '{"reading": "じょうず"}' WHERE id = $1`, [
      id,
    ]);

    expect((await get(`/api/v1/media/audio/item/${id}`)).statusCode).toBe(200);
    expect(tts.calls.map((c) => c.reading)).toEqual(['うわて', 'じょうず']);
    expect((await assets()).map((a) => a.text_hash)).toEqual([sha256('じょうず')]);
  });

  it('serves a current uploaded clip and never overwrites an uploaded one', async () => {
    const tts = fakeTts();
    const get = await start(tts.provider);
    const id = await seedWord('水', 'みず');
    await mkdir(join(mediaDir, 'uploads'));
    await writeFile(join(mediaDir, 'uploads/mizu.opus'), 'recorded');
    const upload = (hash: string) =>
      query(
        pool(),
        `INSERT INTO audio_assets (owner_type, owner_id, path, origin, text_hash)
         VALUES ('item', $1, 'uploads/mizu.opus', 'uploaded', $2)
         ON CONFLICT (owner_type, owner_id, voice, origin) DO UPDATE SET text_hash = $2`,
        [id, hash],
      );

    await upload(sha256('みず'));
    expect((await get(`/api/v1/media/audio/item/${id}`)).payload).toBe('recorded');
    expect(tts.calls).toHaveLength(0);

    // A stale upload: a generated clip is added beside it.
    await upload(sha256('old'));
    expect((await get(`/api/v1/media/audio/item/${id}`)).payload).not.toBe('recorded');
    expect(tts.calls).toHaveLength(1);
    expect((await assets()).map((a) => [a.origin, a.path])).toEqual([
      ['uploaded', 'uploads/mizu.opus'],
      ['generated', `audio/item/${id}-jf_alpha.opus`],
    ]);
    expect(await readFile(join(mediaDir, 'uploads/mizu.opus'), 'utf8')).toBe('recorded');
  });

  it('generates once for two concurrent first requests', async () => {
    const tts = fakeTts();
    const get = await start(tts.provider);
    const id = await seedWord('水', 'みず');
    const [a, b] = await Promise.all([
      get(`/api/v1/media/audio/item/${id}`),
      get(`/api/v1/media/audio/item/${id}`),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(a.rawPayload).toEqual(b.rawPayload);
    expect(tts.calls).toHaveLength(1);
  });

  it('answers 404 for an unknown item', async () => {
    const get = await start(fakeTts().provider);
    expect((await get('/api/v1/media/audio/item/999')).json()).toMatchObject({
      error: { code: 'not_found' },
    });
  });

  it('answers service_unavailable with the engine stopped, and study still works (NFR-23)', async () => {
    // Nothing listens on port 1.
    const get = await start(kokoroProvider('http://127.0.0.1:1'));
    const id = await seedWord('水', 'みず');
    const response = await get(`/api/v1/media/audio/item/${id}`);
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: 'service_unavailable' } });
    expect(await assets()).toEqual([]);
    expect((await get('/api/v1/courses')).statusCode).toBe(200);
  });

  it('stores mono Opus at or under 32 kbps with silence trimmed (NFR-07)', async () => {
    const get = await start(fakeTts().provider);
    const id = await seedWord('水', 'みず');
    expect((await get(`/api/v1/media/audio/item/${id}`)).statusCode).toBe(200);
    const { stdout } = await promisify(execFile)('ffprobe', [
      ...['-v', 'error', '-of', 'json'],
      ...['-show_entries', 'stream=codec_name,channels:format=duration,bit_rate'],
      join(mediaDir, `audio/item/${id}-jf_alpha.opus`),
    ]);
    const probe = JSON.parse(stdout) as {
      streams: { codec_name: string; channels: number }[];
      format: { duration: string; bit_rate: string };
    };
    expect(probe.streams).toEqual([{ codec_name: 'opus', channels: 1 }]);
    expect(Number(probe.format.bit_rate)).toBeLessThanOrEqual(32_000);
    // 2.5 s in, 1.5 s of tone: the 0.5 s pads are cut down to 50 ms each.
    expect(Number(probe.format.duration)).toBeLessThan(1.8);
  });
});

describe('kokoroProvider (IF-09)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('posts only the reading to Kokoro with the voice and lang_code (FR-136)', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    const bytes = await kokoroProvider('http://tts:8880').synthesize({
      text: '水',
      reading: 'みず',
      voice: 'jf_alpha',
      language: 'j',
    });
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://tts:8880/v1/audio/speech');
    expect(JSON.parse(init!.body as string)).toEqual({
      model: 'kokoro',
      input: 'みず',
      voice: 'jf_alpha',
      lang_code: 'j',
      response_format: 'wav',
      speed: 1,
    });
    expect(init!.body).not.toContain('水');
  });

  it('throws when Kokoro fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));
    await expect(
      kokoroProvider('http://tts:8880').synthesize({ text: '', reading: 'a', voice: 'v' }),
    ).rejects.toThrow('Kokoro answered 500');
  });
});

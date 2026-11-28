import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { TtsProvider, TtsRequest } from '@manabi/core';
import { AUDIO_UPLOAD_MAX_BYTES } from '@manabi/core';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { wav } from '../../test/audio';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import { sniffContainer } from './audioFiles';

// Issue #66: FR-132, SDD section 11 (Uploads), FR-006. Needs ffmpeg and ffprobe on the PATH.

const PASSWORD = 'correct horse battery';
const ORIGIN = 'http://localhost:3000';
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const run = promisify(execFile);

/** `input` re-encoded by ffmpeg into another container, e.g. ['-c:a', 'aac', '-f', 'mp4']. */
async function convert(input: Uint8Array, args: string[]): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'manabi-convert-'));
  try {
    await writeFile(join(dir, 'in.wav'), input);
    await run('ffmpeg', ['-v', 'error', '-i', join(dir, 'in.wav'), ...args, join(dir, 'out')]);
    return await readFile(join(dir, 'out'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function fakeTts() {
  const calls: TtsRequest[] = [];
  const provider: TtsProvider = {
    synthesize: async (req) => {
      calls.push(req);
      return wav();
    },
  };
  return { calls, provider };
}

describeWithDb('authoring audio uploads API', () => {
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

  async function as(role: 'admin' | 'learner', tts: TtsProvider = fakeTts().provider) {
    current = await testApp({ pool: pool(), env: { MEDIA_DIR: mediaDir }, tts });
    const app = current.app;
    await seedUser(pool(), { username: role, role, passwordHash: await hashPassword(PASSWORD) });
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: role, password: PASSWORD },
    });
    const cookie = login.cookies.find((c) => c.name === SESSION_COOKIE)!.value;
    return (
      method: 'GET' | 'PUT' | 'DELETE',
      url: string,
      body?: { type: string; bytes: Uint8Array | string },
      headers: Record<string, string> = {},
    ) =>
      app.inject({
        method,
        url: `/api/v1${url}`,
        cookies: { [SESSION_COOKIE]: cookie },
        headers: { origin: ORIGIN, ...headers, ...(body ? { 'content-type': body.type } : {}) },
        ...(body ? { payload: Buffer.from(body.bytes) } : {}),
      });
  }

  async function seedWord(): Promise<number> {
    const courseId = await seedCourse(pool());
    const [row] = await query<{ id: number }>(
      pool(),
      `INSERT INTO items (course_id, key, type, data) VALUES ($1, 'ja:word:水:みず', 'word', $2)
       RETURNING id`,
      [courseId, JSON.stringify({ written: '水', reading: 'みず' })],
    );
    return row!.id;
  }

  const assets = () =>
    query<{ origin: string; path: string; voice: string | null; text_hash: string }>(
      pool(),
      `SELECT origin, path, voice, text_hash FROM audio_assets ORDER BY id`,
    );

  const uploadedFiles = async (dir = join(mediaDir, 'audio/item')) =>
    (await readdir(dir).catch(() => [] as string[])).filter((f) => f.includes('-uploaded-'));

  it('is for admins only (FR-006)', async () => {
    const learner = await as('learner');
    const id = await seedWord();
    const body = { type: 'audio/wav', bytes: wav() };
    expect((await learner('PUT', `/authoring/audio/item/${id}`, body)).statusCode).toBe(403);
    expect((await learner('GET', `/authoring/audio/item/${id}`)).statusCode).toBe(403);
    expect((await learner('DELETE', `/authoring/audio/item/${id}`)).statusCode).toBe(403);
    expect(await assets()).toEqual([]);
  });

  it('replaces the generated clip with an upload for the same word', async () => {
    const tts = fakeTts();
    const admin = await as('admin', tts.provider);
    const id = await seedWord();

    const generated = await admin('GET', `/media/audio/item/${id}`);
    expect(generated.statusCode).toBe(200);
    expect(tts.calls).toHaveLength(1);

    // A 3 s tone, so the uploaded clip differs from the generated 1.5 s one.
    const put = await admin('PUT', `/authoring/audio/item/${id}`, {
      type: 'audio/wav',
      bytes: wav(3),
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ uploaded: true, stale: false });

    const rows = await assets();
    const upload = rows.find((r) => r.origin === 'uploaded')!;
    expect(upload).toMatchObject({ voice: null, text_hash: sha256('みず') });
    // A generated name on the media volume, never the client's.
    expect(upload.path).toMatch(new RegExp(`^audio/item/${id}-uploaded-[0-9a-f]{16}\\.opus$`));
    const stored = await readFile(join(mediaDir, upload.path));
    expect(stored.subarray(0, 4).toString()).toBe('OggS');

    // The browser's cached generated clip is revalidated and replaced by the upload.
    const served = await admin('GET', `/media/audio/item/${id}`, undefined, {
      'if-none-match': generated.headers.etag as string,
    });
    expect(served.statusCode).toBe(200);
    expect(served.headers.etag).not.toBe(generated.headers.etag);
    expect(served.rawPayload).toEqual(stored);
    expect(served.rawPayload).not.toEqual(generated.rawPayload);
    expect(tts.calls).toHaveLength(1);
    expect((await admin('GET', `/authoring/audio/item/${id}`)).json()).toEqual({
      uploaded: true,
      stale: false,
    });
  });

  it('transcodes to mono Opus like a generated clip (NFR-07)', async () => {
    const admin = await as('admin');
    const id = await seedWord();
    await admin('PUT', `/authoring/audio/item/${id}`, { type: 'audio/wav', bytes: wav() });
    const [row] = await assets();
    const { stdout } = await run('ffprobe', [
      ...['-v', 'error', '-of', 'json', '-show_entries', 'stream=codec_name,channels'],
      join(mediaDir, row!.path),
    ]);
    expect(JSON.parse(stdout)).toMatchObject({ streams: [{ codec_name: 'opus', channels: 1 }] });
  });

  it.each([
    ['MP3', 'audio/mpeg', ['-c:a', 'libmp3lame', '-f', 'mp3']],
    ['M4A (index at the end)', 'audio/mp4', ['-c:a', 'aac', '-f', 'mp4']],
    ['WebM', 'audio/webm; codecs=opus', ['-c:a', 'libopus', '-f', 'webm']],
    ['Ogg Opus', 'audio/ogg', ['-c:a', 'libopus', '-f', 'ogg']],
  ])('accepts %s', async (_name, type, args) => {
    const admin = await as('admin');
    const id = await seedWord();
    const bytes = await convert(wav(), args);
    const put = await admin('PUT', `/authoring/audio/item/${id}`, { type, bytes });
    expect(put.json()).toEqual({ uploaded: true, stale: false });
  });

  it('accepts a recording for a sentence', async () => {
    const admin = await as('admin');
    const itemId = await seedWord();
    const [sentence] = await query<{ id: number }>(
      pool(),
      `INSERT INTO sentences (course_id, text, tokens, translation)
       SELECT course_id, '水です', $1, 'It is water.' FROM items WHERE id = $2 RETURNING id`,
      [
        JSON.stringify([
          { surface: '水', base: '水', reading: 'みず' },
          { surface: 'です', base: 'です', reading: 'です' },
        ]),
        itemId,
      ],
    );
    const put = await admin('PUT', `/authoring/audio/sentence/${sentence!.id}`, {
      type: 'audio/wav',
      bytes: wav(),
    });
    expect(put.statusCode).toBe(200);
    expect(await assets()).toEqual([
      expect.objectContaining({ origin: 'uploaded', text_hash: sha256('みずです') }),
    ]);
  });

  it('rejects a body that is not an audio type', async () => {
    const admin = await as('admin');
    const id = await seedWord();
    for (const type of ['application/json', 'text/plain', 'image/png', 'video/mp4']) {
      const put = await admin('PUT', `/authoring/audio/item/${id}`, { type, bytes: '{}' });
      expect([400, 415]).toContain(put.statusCode);
      expect(put.json().error.code).toMatch(/bad_request|validation_failed/);
    }
    expect(await assets()).toEqual([]);
  });

  it('rejects non-audio bytes sent with an audio type', async () => {
    const admin = await as('admin');
    const id = await seedWord();
    const attempts: [string, Uint8Array | string][] = [
      ['audio/mpeg', 'hello, I am text'],
      // An HLS playlist would make a guessing ffmpeg fetch other files or URLs.
      ['audio/ogg', '#EXTM3U\n#EXTINF:1,\nfile:///etc/passwd\n'],
      // The right magic bytes and nothing behind them.
      ['audio/ogg', 'OggS' + 'x'.repeat(200)],
      ['audio/wav', ''],
      ['audio/mp4', '\0\0\0\x20ftypisom' + '\0'.repeat(100)],
    ];
    for (const [type, bytes] of attempts) {
      const put = await admin('PUT', `/authoring/audio/item/${id}`, { type, bytes });
      expect(put.statusCode).toBe(400);
      expect(put.json().error.code).toBe('bad_request');
    }
    expect(await assets()).toEqual([]);
    expect(await uploadedFiles()).toEqual([]);
  });

  it('rejects an oversize file', async () => {
    const admin = await as('admin');
    const id = await seedWord();
    const bytes = Buffer.concat([Buffer.from(wav()), Buffer.alloc(AUDIO_UPLOAD_MAX_BYTES)]);
    const put = await admin('PUT', `/authoring/audio/item/${id}`, { type: 'audio/wav', bytes });
    expect(put.statusCode).toBe(413);
    expect(put.json().error.code).toBe('payload_too_large');
    expect(await assets()).toEqual([]);
  });

  it('rejects a recording longer than 30 seconds', async () => {
    const admin = await as('admin');
    const id = await seedWord();
    const bytes = wav(31, { rate: 8000, channels: 1 });
    const put = await admin('PUT', `/authoring/audio/item/${id}`, { type: 'audio/wav', bytes });
    expect(put.statusCode).toBe(400);
    expect(put.json().error.message).toMatch(/30 seconds/);
  });

  it('decodes at most 30 seconds of a file whose header claims less (DoS)', async () => {
    const admin = await as('admin');
    const id = await seedWord();
    // 60 s of tone in Matroska, with the header's Duration patched down to 1 s.
    const mkv = await convert(wav(60, { rate: 8000, channels: 1 }), [
      ...['-c:a', 'libopus', '-b:a', '6k', '-f', 'matroska'],
    ]);
    const at = mkv.indexOf(Buffer.from([0x44, 0x89]));
    expect(at).toBeGreaterThan(0);
    const size = mkv[at + 2]! & 0x7f;
    if (size === 8) mkv.writeDoubleBE(1000, at + 3);
    else mkv.writeFloatBE(1000, at + 3);
    const put = await admin('PUT', `/authoring/audio/item/${id}`, {
      type: 'audio/webm',
      bytes: mkv,
    });
    expect(put.statusCode).toBe(200);
    const [row] = await assets();
    const { stdout } = await run('ffprobe', [
      ...['-v', 'error', '-of', 'json', '-show_entries', 'format=duration'],
      join(mediaDir, row!.path),
    ]);
    expect(
      Number((JSON.parse(stdout) as { format: { duration: string } }).format.duration),
    ).toBeLessThanOrEqual(30.5);
  });

  it('answers 404 for an unknown owner and stores nothing', async () => {
    const admin = await as('admin');
    await seedWord();
    const put = await admin('PUT', '/authoring/audio/item/999', {
      type: 'audio/wav',
      bytes: wav(),
    });
    expect(put.statusCode).toBe(404);
    expect(await assets()).toEqual([]);
    expect(await uploadedFiles()).toEqual([]);
  });

  it('replaces an earlier upload and removes its file', async () => {
    const admin = await as('admin');
    const id = await seedWord();
    await admin('PUT', `/authoring/audio/item/${id}`, { type: 'audio/wav', bytes: wav() });
    const [first] = await assets();
    await admin('PUT', `/authoring/audio/item/${id}`, { type: 'audio/wav', bytes: wav(2) });
    const rows = await assets();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.path).not.toBe(first!.path);
    expect(await uploadedFiles()).toEqual([rows[0]!.path.split('/').pop()]);
  });

  it('reports a stale upload after the reading changes, and removes an upload', async () => {
    const tts = fakeTts();
    const admin = await as('admin', tts.provider);
    const id = await seedWord();
    await admin('PUT', `/authoring/audio/item/${id}`, { type: 'audio/wav', bytes: wav() });
    await query(pool(), `UPDATE items SET overrides = '{"reading": "すい"}' WHERE id = $1`, [id]);
    expect((await admin('GET', `/authoring/audio/item/${id}`)).json()).toEqual({
      uploaded: true,
      stale: true,
    });

    const removed = await admin('DELETE', `/authoring/audio/item/${id}`);
    expect(removed.json()).toEqual({ uploaded: false, stale: false });
    expect(await assets()).toEqual([]);
    expect(await uploadedFiles()).toEqual([]);
    // The generated clip plays again.
    expect((await admin('GET', `/media/audio/item/${id}`)).statusCode).toBe(200);
    expect(tts.calls.map((c) => c.reading)).toEqual(['すい']);
  });
});

describe('sniffContainer (SDD section 11)', () => {
  it('names the demuxer from the leading bytes, and nothing for other files', () => {
    const bytes = (s: string) => Buffer.from(s, 'latin1');
    expect(sniffContainer(bytes('OggS\0\x02'))).toBe('ogg');
    expect(sniffContainer(bytes('RIFF\0\0\0\0WAVEfmt '))).toBe('wav');
    expect(sniffContainer(bytes('ID3\x04'))).toBe('mp3');
    expect(sniffContainer(Buffer.from([0xff, 0xfb, 0x90, 0x00]))).toBe('mp3');
    expect(sniffContainer(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]))).toBe('matroska');
    expect(sniffContainer(bytes('\0\0\0\x20ftypM4A '))).toBe('mov');
    expect(sniffContainer(bytes('fLaC'))).toBe('flac');
    expect(sniffContainer(bytes('#EXTM3U'))).toBeNull();
    expect(sniffContainer(bytes('\x89PNG'))).toBeNull();
    expect(sniffContainer(bytes('RIFF\0\0\0\0AVI '))).toBeNull();
    expect(sniffContainer(new Uint8Array())).toBeNull();
  });
});

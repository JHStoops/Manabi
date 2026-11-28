import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pino from 'pino';
import { ContentPackError } from '@manabi/core';
import type { TtsProvider } from '@manabi/core';
import { query, queryOne } from '../../db/db';
import { wav } from '../../test/audio';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { audioClip } from '../media/service';
import { readPack, writePack } from './packFiles';
import { exportPack, importPack } from './service';

// Issue #128: recorded clips in a pack's audio/ folder (SDD sections 4 and 5, FR-227, FR-132).
// Needs ffmpeg and ffprobe on the PATH.

const FIXTURE = join(__dirname, '../../test/fixtures/ja-en');
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const CLIPS_YAML = `- file: mizu.wav
  item: ja:word:水:みず
- file: tatoeba-4702.wav
  sentence:
    source: tatoeba
    sourceId: '4702'
- file: mizu-desu.wav
  sentence:
    text: 水です。
`;

describeWithDb('content pack audio clips', () => {
  const pool = useTestDatabase();
  const dirs: string[] = [];
  const tmp = async (prefix: string) => {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    dirs.push(dir);
    return dir;
  };
  let mediaDir: string;

  beforeEach(async () => {
    mediaDir = await tmp('manabi-media-');
  });
  afterAll(async () => {
    for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  });

  /** The fixture pack plus an audio/ folder with `clips` and these files. */
  async function packWithAudio(clips = CLIPS_YAML, files: Record<string, Uint8Array> = {}) {
    const dir = await tmp('manabi-pack-');
    await cp(FIXTURE, dir, { recursive: true });
    await mkdir(join(dir, 'audio'));
    await writeFile(join(dir, 'audio/clips.yaml'), clips);
    const all = {
      'mizu.wav': wav(1),
      'tatoeba-4702.wav': wav(2),
      'mizu-desu.wav': wav(1.5),
      ...files,
    };
    for (const [name, bytes] of Object.entries(all))
      await writeFile(join(dir, 'audio', name), bytes);
    return dir;
  }

  const assets = () =>
    query<{
      owner_type: string;
      owner_id: number;
      origin: string;
      path: string;
      text_hash: string;
    }>(
      pool(),
      `SELECT owner_type, owner_id, origin, path, text_hash FROM audio_assets ORDER BY id`,
    );
  const filesIn = async (sub: string) =>
    (await readdir(join(mediaDir, sub)).catch(() => [])).sort();
  const idOf = async (sql: string) => (await queryOne<{ id: number }>(pool(), sql))!.id;

  it('imports recorded clips as uploads for the current reading', async () => {
    await importPack(pool(), await readPack(await packWithAudio()), false, mediaDir);

    const water = await idOf(`SELECT id FROM items WHERE key = 'ja:word:水:みず'`);
    const tatoeba = await idOf(`SELECT id FROM sentences WHERE source_id = '4702'`);
    const authored = await idOf(`SELECT id FROM sentences WHERE text = '水です。'`);
    const rows = await assets();
    expect(rows.map(({ path: _, ...r }) => r)).toEqual([
      { owner_type: 'item', owner_id: water, origin: 'uploaded', text_hash: sha256('みず') },
      {
        owner_type: 'sentence',
        owner_id: tatoeba,
        origin: 'uploaded',
        text_hash: expect.any(String),
      },
      {
        owner_type: 'sentence',
        owner_id: authored,
        origin: 'uploaded',
        text_hash: expect.any(String),
      },
    ]);
    // Transcoded to Opus under generated names (SDD section 11).
    for (const row of rows) {
      expect(row.path).toMatch(/^audio\/(item|sentence)\/\d+-uploaded-[0-9a-f]{16}\.opus$/);
      expect((await readFile(join(mediaDir, row.path))).subarray(0, 4).toString()).toBe('OggS');
    }
  });

  it('plays a recorded clip instead of generating one after import', async () => {
    await importPack(pool(), await readPack(await packWithAudio()), false, mediaDir);
    const water = await idOf(`SELECT id FROM items WHERE key = 'ja:word:水:みず'`);
    const calls: unknown[] = [];
    const tts: TtsProvider = {
      synthesize: async (req) => {
        calls.push(req);
        return wav();
      },
    };
    const clip = await audioClip({
      db: pool(),
      tts,
      mediaDir,
      log: pino({ level: 'silent' }),
      ownerType: 'item',
      ownerId: water,
    });
    const [row] = await assets();
    expect(clip).toEqual(await readFile(join(mediaDir, row!.path)));
    expect(calls).toEqual([]);
  });

  it('round trips uploaded clips and their rows; generated clips are not exported', async () => {
    await importPack(pool(), await readPack(await packWithAudio()), false, mediaDir);
    const water = await idOf(`SELECT id FROM items WHERE key = 'ja:word:水:みず'`);
    await mkdir(join(mediaDir, 'audio/item'), { recursive: true });
    await writeFile(join(mediaDir, 'audio/item/generated.opus'), 'generated');
    await query(
      pool(),
      `INSERT INTO audio_assets (owner_type, owner_id, voice, path, origin, text_hash)
       VALUES ('item', $1, 'jf_alpha', 'audio/item/generated.opus', 'generated', 'x')`,
      [water],
    );
    const before = await assets();

    const exported = await exportPack(pool(), 'ja-en', mediaDir);
    expect(exported.audio?.map(({ data: _, ...entry }) => entry)).toEqual([
      { file: expect.stringMatching(/^item-[0-9a-f]{16}\.opus$/), item: 'ja:word:水:みず' },
      {
        file: expect.stringMatching(/^sentence-[0-9a-f]{16}\.opus$/),
        sentence: { source: 'tatoeba', sourceId: '4702' },
      },
      {
        file: expect.stringMatching(/^sentence-[0-9a-f]{16}\.opus$/),
        sentence: { text: '水です。' },
      },
    ]);
    const out = await tmp('manabi-export-');
    await writePack(out, exported);
    expect((await readdir(join(out, 'audio'))).sort()).toEqual(
      ['clips.yaml', ...exported.audio!.map((c) => c.file)].sort(),
    );
    // The stored Opus files, byte for byte.
    const uploaded = before.filter((r) => r.origin === 'uploaded');
    for (const [i, clip] of exported.audio!.entries()) {
      expect(await readFile(join(out, 'audio', clip.file))).toEqual(
        await readFile(join(mediaDir, uploaded[i]!.path)),
      );
    }

    // Importing the export back keeps every row and file as it was: nothing is re-encoded.
    await importPack(pool(), await readPack(out), false, mediaDir);
    expect(await assets()).toEqual(before);
    expect(await exportPack(pool(), 'ja-en', mediaDir)).toEqual(exported);
    // An export without clips removes the clips an earlier export wrote.
    await writePack(out, { ...exported, audio: [] });
    expect(await readdir(join(out, 'audio'))).toEqual([]);
  });

  it('replaces an earlier upload when the pack carries a different recording', async () => {
    await importPack(pool(), await readPack(await packWithAudio()), false, mediaDir);
    const [first] = await assets();
    const changed = await packWithAudio(undefined, { 'mizu.wav': wav(3) });
    await importPack(pool(), await readPack(changed), false, mediaDir);
    const [second] = await assets();
    expect(second!.path).not.toBe(first!.path);
    expect(await filesIn('audio/item')).toEqual([second!.path.split('/').pop()]);
  });

  it('never writes to progress tables', async () => {
    await importPack(pool(), await readPack(FIXTURE));
    const user = await seedUser(pool());
    const water = await idOf(`SELECT id FROM items WHERE key = 'ja:word:水:みず'`);
    await query(
      pool(),
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, 'meaning', 3, now())`,
      [user.id, water],
    );
    const progress = () => query(pool(), `SELECT * FROM item_progress`);
    const before = await progress();
    await importPack(pool(), await readPack(await packWithAudio()), false, mediaDir);
    expect(await progress()).toEqual(before);
  });

  it('rejects a clip whose owner is not in the course, writing nothing', async () => {
    const clips = `${CLIPS_YAML}- file: other.wav\n  item: ja:word:火:ひ\n`;
    const pack = await readPack(await packWithAudio(clips, { 'other.wav': wav() }));
    await expect(importPack(pool(), pack, false, mediaDir)).rejects.toThrow(
      'audio/other.wav: no active item ja:word:火:ひ in the course',
    );
    const unknownSentence = `- file: mizu.wav\n  sentence:\n    text: 火です。\n`;
    const pack2 = await readPack(
      await packWithAudio(unknownSentence, {}).then(async (dir) => {
        for (const f of ['tatoeba-4702.wav', 'mizu-desu.wav']) await rm(join(dir, 'audio', f));
        return dir;
      }),
    );
    await expect(importPack(pool(), pack2, false, mediaDir)).rejects.toThrow(
      'audio/mizu.wav: no such sentence in the course',
    );
    expect(await query(pool(), 'SELECT * FROM courses')).toEqual([]);
    expect(await assets()).toEqual([]);
    expect(await filesIn('audio/item')).toEqual([]);
    expect(await filesIn('audio/sentence')).toEqual([]);
  });

  it('rejects a clip that is not audio and removes the clips already written', async () => {
    const pack = await readPack(
      await packWithAudio(undefined, { 'mizu-desu.wav': Buffer.from('not audio at all') }),
    );
    await expect(importPack(pool(), pack, false, mediaDir)).rejects.toThrow(
      /^audio\/mizu-desu\.wav: Not a supported audio file/,
    );
    expect(await assets()).toEqual([]);
    expect(await filesIn('audio/item')).toEqual([]);
    expect(await filesIn('audio/sentence')).toEqual([]);
  });

  it('reports listing problems when reading the pack', async () => {
    const clips = [
      '- file: ../escape.opus',
      '  item: ja:word:水:みず',
      '- file: missing.opus',
      '  item: ja:word:水:みず',
      '- file: both.opus',
      '  item: ja:word:水:みず',
      '  sentence: { text: 水です。 }',
      '',
    ].join('\n');
    const dir = await packWithAudio(clips, { 'both.opus': wav() });
    const error = await readPack(dir).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContentPackError);
    const problems = (error as ContentPackError).problems;
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^audio\/clips\.yaml:1: 0\.file: a file name in audio\//),
        expect.stringMatching(/^audio\/clips\.yaml:6: 2\.item: name either an item or a sentence/),
      ]),
    );
  });

  it('reports a listed file that is missing and a file nobody listed', async () => {
    const clips = `- file: missing.opus\n  item: ja:word:水:みず\n`;
    const error = await readPack(await packWithAudio(clips, {})).catch((e: unknown) => e);
    expect((error as ContentPackError).problems).toEqual([
      'audio/clips.yaml:1: file: audio/missing.opus not found',
      'audio/mizu-desu.wav: (root): not listed in audio/clips.yaml',
      'audio/mizu.wav: (root): not listed in audio/clips.yaml',
      'audio/tatoeba-4702.wav: (root): not listed in audio/clips.yaml',
    ]);
  });

  it('rejects two clips for one owner', async () => {
    const clips = `${CLIPS_YAML}- file: again.wav\n  item: ja:word:水:みず\n`;
    const pack = await readPack(await packWithAudio(clips, { 'again.wav': wav() }));
    await expect(importPack(pool(), pack, false, mediaDir)).rejects.toThrow(
      'duplicate audio clip for item ja:word:水:みず',
    );
  });

  it('refuses clips when the import has no media folder', async () => {
    const pack = await readPack(await packWithAudio());
    await expect(importPack(pool(), pack)).rejects.toThrow('this import cannot store audio clips');
  });
});

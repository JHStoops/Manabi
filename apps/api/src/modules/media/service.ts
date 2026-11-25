import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import type { TtsProvider } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { AppError } from '../../errors';
import { languagePlugins } from '../../plugins';
import type { AudioOwnerType } from '../content/rows';
import { findAudioOwner, listAudioAssets, upsertGeneratedAudio } from './queries';

// NFR-07, docs/spikes/tts.md (Setup): trim leading and trailing silence (keeping 50 ms), downmix
// to mono and encode Ogg Opus at 24 kbps. Constrained VBR keeps a clip under the 32 kbps ceiling;
// plain VBR measured 34 kbps on a short tonal clip.
const TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05';
const FFMPEG_ARGS = [
  ...'-hide_banner -loglevel error -i pipe:0 -af'.split(' '),
  `${TRIM},areverse,${TRIM},areverse`,
  ...'-ac 1 -c:a libopus -b:a 24k -vbr constrained -application voip -f ogg pipe:1'.split(' '),
];

function encodeOpus(wav: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'ffmpeg',
      FFMPEG_ARGS,
      { encoding: 'buffer', timeout: 10_000, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    );
    // ffmpeg exiting early closes stdin (EPIPE); the callback above reports why.
    child.stdin?.on('error', () => {});
    child.stdin?.end(wav);
  });
}

// FR-131: one generation per clip file at a time; concurrent requests wait for it. The API is a
// single process (SDD section 2), so an in-memory map is enough.
const generating = new Map<string, Promise<void>>();

interface ClipRequest {
  db: Queryable;
  tts: TtsProvider;
  mediaDir: string;
  log: FastifyBaseLogger;
  ownerType: AudioOwnerType;
  ownerId: number;
}

/**
 * FR-131, FR-136: the Opus clip of an item or sentence. An uploaded or generated clip whose
 * text_hash matches the current reading is served from disk; otherwise it is generated from the
 * reading, stored on the media volume and recorded. Uploaded clips are never overwritten.
 */
export async function audioClip(req: ClipRequest): Promise<Buffer> {
  const { db, ownerType, ownerId } = req;
  const owner = await findAudioOwner(db, ownerType, ownerId);
  if (!owner) throw new AppError('not_found', `No such ${ownerType}`);
  const plugin = languagePlugins.get(owner.plugin);
  const { voice, providerLanguage, input } = plugin.ttsVoice;
  const reading =
    input === 'written'
      ? owner.text
      : owner.tiles
        ? plugin.readingOf(owner.tiles)
        : (owner.reading ?? '');
  if (reading === '') throw new AppError('not_found', `This ${ownerType} has no reading to speak`);
  // DR (0001): text_hash is the hash of what the engine is sent; a mismatch means stale audio.
  const textHash = createHash('sha256').update(reading).digest('hex');

  const assets = await listAudioAssets(db, ownerType, ownerId);
  const current =
    assets.find((a) => a.origin === 'uploaded' && a.text_hash === textHash) ??
    assets.find((a) => a.origin === 'generated' && a.voice === voice && a.text_hash === textHash);
  if (current) return readFile(join(req.mediaDir, current.path));

  const path = `audio/${ownerType}/${ownerId}-${voice}.opus`;
  let pending = generating.get(path);
  if (!pending) {
    pending = (async () => {
      const opus = await encodeOpus(
        await req.tts.synthesize({ text: owner.text, reading, voice, language: providerLanguage }),
      );
      const file = join(req.mediaDir, path);
      await mkdir(dirname(file), { recursive: true });
      // Written whole then renamed, so a concurrent read of the stale clip never sees half a file.
      await writeFile(`${file}.tmp`, opus);
      await rename(`${file}.tmp`, file);
      await upsertGeneratedAudio(db, { ownerType, ownerId, voice, path, textHash });
    })().finally(() => generating.delete(path));
    generating.set(path, pending);
  }
  try {
    await pending;
  } catch (err) {
    // NFR-23: the client falls back to the device voice on this code.
    req.log.warn({ err, ownerType, ownerId }, 'Audio generation failed');
    throw new AppError('service_unavailable', 'Speech engine unavailable');
  }
  return readFile(join(req.mediaDir, path));
}

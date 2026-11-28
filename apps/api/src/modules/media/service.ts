import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import type { Pool } from 'pg';
import type { AuthoringAudioStatus, PackAudioClip, StrokeData, TtsProvider } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import { languagePlugins } from '../../plugins';
import type { AudioOwnerType } from '../content/rows';
import {
  AudioFileError,
  encodeOpus,
  removeClip,
  transcodeUpload,
  uploadedClipPath,
  writeClip,
} from './audioFiles';
import {
  deleteUploadedAudio,
  findAudioOwner,
  findStrokeData,
  findUploadedAudio,
  listAudioAssets,
  listCourseUploadedAudio,
  lockAudioOwner,
  upsertGeneratedAudio,
  upsertUploadedAudio,
} from './queries';
import type { AudioOwnerRow } from './rows';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/**
 * FR-136: what the engine is sent for an owner (the kana reading for Japanese; a sentence's comes
 * from its tiles), and the voice. DR (0001): text_hash is the hash of `reading`.
 */
function spoken(owner: AudioOwnerRow) {
  const plugin = languagePlugins.get(owner.plugin);
  const { voice, providerLanguage, input } = plugin.ttsVoice;
  const reading =
    input === 'written'
      ? owner.text
      : owner.tiles
        ? plugin.readingOf(owner.tiles)
        : (owner.reading ?? '');
  return { voice, providerLanguage, reading, textHash: sha256(reading) };
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

/** A clip on the media volume, and its entity tag for conditional requests. */
export interface ClipFile {
  path: string;
  /**
   * #66: changes whenever the clip that plays changes: a new upload (a new path) or a new reading
   * (a new text_hash), so a browser that revalidates never keeps playing an old clip.
   */
  etag: string;
}

const clipFile = (path: string, textHash: string): ClipFile => ({
  path,
  etag: `"${sha256(`${path}\n${textHash}`).slice(0, 32)}"`,
});

/**
 * FR-131, FR-132, FR-136: the Opus clip of an item or sentence. An uploaded clip whose text_hash
 * matches the current reading wins; then a current generated one. Otherwise a clip is generated
 * from the reading, stored on the media volume and recorded. Uploaded clips are never overwritten.
 */
export async function resolveClip(req: ClipRequest): Promise<ClipFile> {
  const { db, ownerType, ownerId } = req;
  const owner = await findAudioOwner(db, ownerType, ownerId);
  if (!owner) throw new AppError('not_found', `No such ${ownerType}`);
  const { voice, providerLanguage, reading, textHash } = spoken(owner);
  if (reading === '') throw new AppError('not_found', `This ${ownerType} has no reading to speak`);

  const assets = await listAudioAssets(db, ownerType, ownerId);
  const current =
    assets.find((a) => a.origin === 'uploaded' && a.text_hash === textHash) ??
    assets.find((a) => a.origin === 'generated' && a.voice === voice && a.text_hash === textHash);
  if (current) return clipFile(current.path, textHash);

  const path = `audio/${ownerType}/${ownerId}-${voice}.opus`;
  let pending = generating.get(path);
  if (!pending) {
    pending = (async () => {
      const opus = await encodeOpus(
        await req.tts.synthesize({ text: owner.text, reading, voice, language: providerLanguage }),
      );
      // Written whole then renamed, so a concurrent read of the stale clip never sees half a file.
      await writeClip(req.mediaDir, path, opus);
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
  return clipFile(path, textHash);
}

/** The bytes of the clip resolveClip finds or generates. */
export async function audioClip(req: ClipRequest): Promise<Buffer> {
  return readFile(join(req.mediaDir, (await resolveClip(req)).path));
}

/** FR-071, FR-077: a character's stroke data for the stroke canvas; 404 when it has none. */
export async function getStrokes(db: Queryable, itemKey: string): Promise<StrokeData> {
  const strokes = await findStrokeData(db, itemKey);
  if (!strokes) throw new AppError('not_found', 'No stroke data for this item');
  return strokes;
}

/** FR-132: whether an owner has an uploaded clip, and whether it was made for today's reading. */
export async function uploadStatus(
  db: Queryable,
  ownerType: AudioOwnerType,
  ownerId: number,
): Promise<AuthoringAudioStatus> {
  const owner = await findAudioOwner(db, ownerType, ownerId);
  if (!owner) throw new AppError('not_found', `No such ${ownerType}`);
  const upload = await findUploadedAudio(db, ownerType, ownerId);
  return {
    uploaded: upload !== null,
    stale: !!upload && upload.text_hash !== spoken(owner).textHash,
  };
}

/**
 * FR-132: records `clip` (already transcoded) as the owner's uploaded recording, for the reading
 * it has now, replacing any earlier upload. Runs on `db`, inside the caller's transaction. The new
 * file is written first; the caller removes `replaced` once the transaction has committed and
 * `written` if it rolls back.
 */
export async function storeUploadedClip(
  db: Queryable,
  mediaDir: string,
  owner: { ownerType: AudioOwnerType; ownerId: number },
  clip: Uint8Array,
): Promise<{ written: string; replaced: string | null }> {
  const { ownerType, ownerId } = owner;
  const row = await lockAudioOwner(db, ownerType, ownerId);
  if (!row) throw new AppError('not_found', `No such ${ownerType}`);
  const { reading, textHash } = spoken(row);
  if (reading === '') {
    throw new AppError('bad_request', `This ${ownerType} has no reading to record`);
  }
  const before = await findUploadedAudio(db, ownerType, ownerId);
  const path = uploadedClipPath(ownerType, ownerId);
  await writeClip(mediaDir, path, clip);
  await upsertUploadedAudio(db, { ownerType, ownerId, path, textHash });
  return { written: path, replaced: before?.path ?? null };
}

/**
 * FR-132, SDD section 11 (Uploads): an author's recording replaces the generated clip of an item
 * or sentence. The bytes are checked and transcoded to Opus (audioFiles.ts); only the result is
 * stored, under a generated name on the media volume.
 */
export async function uploadClip(
  pool: Pool,
  mediaDir: string,
  owner: { ownerType: AudioOwnerType; ownerId: number },
  bytes: Uint8Array,
): Promise<AuthoringAudioStatus> {
  let clip: Buffer;
  try {
    clip = await transcodeUpload(bytes);
  } catch (err) {
    if (err instanceof AudioFileError) throw new AppError('bad_request', err.message);
    throw err;
  }
  let written: string | null = null;
  try {
    const result = await withTransaction(pool, async (db) => {
      const stored = await storeUploadedClip(db, mediaDir, owner, clip);
      written = stored.written;
      return stored;
    });
    if (result.replaced) await removeClip(mediaDir, result.replaced);
  } catch (err) {
    if (written) await removeClip(mediaDir, written);
    throw err;
  }
  return { uploaded: true, stale: false };
}

/** FR-132: removes an owner's uploaded recording; the generated clip plays again. */
export async function removeUpload(
  pool: Pool,
  mediaDir: string,
  owner: { ownerType: AudioOwnerType; ownerId: number },
): Promise<AuthoringAudioStatus> {
  const { ownerType, ownerId } = owner;
  if (!(await findAudioOwner(pool, ownerType, ownerId))) {
    throw new AppError('not_found', `No such ${ownerType}`);
  }
  const path = await deleteUploadedAudio(pool, ownerType, ownerId);
  if (path) await removeClip(mediaDir, path);
  return { uploaded: false, stale: false };
}

/**
 * #128: records a content pack's recorded clip for an owner, inside the import's transaction.
 * A clip whose bytes equal the stored upload (a pack exported here and imported back) keeps its
 * file, so round trips never re-encode it; otherwise it is checked and transcoded like an upload.
 * Either way it is recorded for the owner's current reading. Throws AudioFileError for bad audio.
 */
export async function storePackClip(
  db: Queryable,
  mediaDir: string,
  owner: { ownerType: AudioOwnerType; ownerId: number },
  bytes: Uint8Array,
): Promise<{ written: string | null; replaced: string | null }> {
  const { ownerType, ownerId } = owner;
  const before = await findUploadedAudio(db, ownerType, ownerId);
  const stored = before && (await readFile(join(mediaDir, before.path)).catch(() => null));
  if (before && stored?.equals(bytes)) {
    const row = await lockAudioOwner(db, ownerType, ownerId);
    if (!row) throw new AppError('not_found', `No such ${ownerType}`);
    const { textHash } = spoken(row);
    await upsertUploadedAudio(db, { ownerType, ownerId, path: before.path, textHash });
    return { written: null, replaced: null };
  }
  return storeUploadedClip(db, mediaDir, owner, await transcodeUpload(bytes));
}

/**
 * #128: a course's uploaded clips as pack entries, with file names that stay the same from one
 * export to the next (a hash of the owner's reference) and the stored Opus bytes. Generated
 * clips are never exported: they are made again on first play.
 */
export async function exportCourseClips(
  db: Queryable,
  mediaDir: string,
  courseId: number,
): Promise<PackAudioClip[]> {
  const clips: PackAudioClip[] = [];
  for (const row of await listCourseUploadedAudio(db, courseId)) {
    const data = await readFile(join(mediaDir, row.path));
    if (row.owner_type === 'item') {
      const file = `item-${sha256(row.item_key!).slice(0, 16)}.opus`;
      clips.push({ file, item: row.item_key!, data });
    } else {
      const sentence =
        row.sentence_source !== null
          ? { source: row.sentence_source, sourceId: row.sentence_source_id! }
          : { text: row.sentence_text! };
      const file = `sentence-${sha256(JSON.stringify(sentence)).slice(0, 16)}.opus`;
      clips.push({ file, sentence, data });
    }
  }
  return clips;
}

/** The bytes of a stored clip. */
export function readClip(mediaDir: string, path: string): Promise<Buffer> {
  return readFile(join(mediaDir, path));
}

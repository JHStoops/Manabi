import type { StrokeData } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { query, queryOne } from '../../db/db';
import type { AudioOwnerType } from '../content/rows';
import type { AudioAssetPathRow, AudioOwnerRow } from './rows';

// Hand-written, parameterized SQL for audio clips (FR-131) and stroke data (FR-077).

const OWNER_SQL: Record<AudioOwnerType, string> = {
  item: `SELECT c.plugin,
                COALESCE(i.overrides->>'written', i.data->>'written', i.key) AS text,
                COALESCE(i.overrides->>'reading', i.data->>'reading') AS reading,
                NULL AS tiles
           FROM items i JOIN courses c ON c.id = i.course_id
          WHERE i.id = $1`,
  sentence: `SELECT c.plugin, s.text, NULL AS reading, s.tokens AS tiles
               FROM sentences s JOIN courses c ON c.id = s.course_id
              WHERE s.id = $1`,
};

export function findAudioOwner(
  db: Queryable,
  ownerType: AudioOwnerType,
  ownerId: number,
): Promise<AudioOwnerRow | null> {
  return queryOne<AudioOwnerRow>(db, OWNER_SQL[ownerType], [ownerId]);
}

/**
 * The owner, locked until the transaction ends, so its reading cannot change while an upload
 * records the hash of it, and two uploads for one owner take turns.
 */
export function lockAudioOwner(
  db: Queryable,
  ownerType: AudioOwnerType,
  ownerId: number,
): Promise<AudioOwnerRow | null> {
  const table = ownerType === 'item' ? 'i' : 's';
  return queryOne<AudioOwnerRow>(db, `${OWNER_SQL[ownerType]} FOR UPDATE OF ${table}`, [ownerId]);
}

/** FR-132: the uploaded clip of an owner, if any. */
export function findUploadedAudio(
  db: Queryable,
  ownerType: AudioOwnerType,
  ownerId: number,
): Promise<{ path: string; text_hash: string } | null> {
  return queryOne(
    db,
    `SELECT path, text_hash FROM audio_assets
      WHERE owner_type = $1 AND owner_id = $2 AND origin = 'uploaded'`,
    [ownerType, ownerId],
  );
}

/** FR-132: records an uploaded clip, replacing the owner's previous upload (voice is null). */
export async function upsertUploadedAudio(
  db: Queryable,
  clip: { ownerType: AudioOwnerType; ownerId: number; path: string; textHash: string },
): Promise<void> {
  await query(
    db,
    `INSERT INTO audio_assets (owner_type, owner_id, voice, path, origin, text_hash)
     VALUES ($1, $2, NULL, $3, 'uploaded', $4)
     ON CONFLICT (owner_type, owner_id, voice, origin)
     DO UPDATE SET path = EXCLUDED.path, text_hash = EXCLUDED.text_hash, created_at = now()`,
    [clip.ownerType, clip.ownerId, clip.path, clip.textHash],
  );
}

/** FR-132: forgets an owner's uploaded clip; returns its path so the file can go too. */
export async function deleteUploadedAudio(
  db: Queryable,
  ownerType: AudioOwnerType,
  ownerId: number,
): Promise<string | null> {
  const row = await queryOne<{ path: string }>(
    db,
    `DELETE FROM audio_assets
      WHERE owner_type = $1 AND owner_id = $2 AND origin = 'uploaded'
      RETURNING path`,
    [ownerType, ownerId],
  );
  return row?.path ?? null;
}

/** One uploaded clip of a course with the stable reference a pack names its owner by. */
export interface UploadedClipRow {
  owner_type: AudioOwnerType;
  path: string;
  item_key: string | null;
  sentence_source: string | null;
  sentence_source_id: string | null;
  sentence_text: string | null;
}

/** #128: a course's uploaded clips whose owner is active, for pack export, in a stable order. */
export function listCourseUploadedAudio(
  db: Queryable,
  courseId: number,
): Promise<UploadedClipRow[]> {
  return query<UploadedClipRow>(
    db,
    `SELECT a.owner_type, a.path, i.key AS item_key, s.source AS sentence_source,
            s.source_id AS sentence_source_id, s.text AS sentence_text
       FROM audio_assets a
       LEFT JOIN items i ON a.owner_type = 'item' AND i.id = a.owner_id
       LEFT JOIN sentences s ON a.owner_type = 'sentence' AND s.id = a.owner_id
      WHERE a.origin = 'uploaded'
        AND ((i.course_id = $1 AND i.archived_at IS NULL)
             OR (s.course_id = $1 AND s.archived_at IS NULL))
      ORDER BY a.owner_type, a.owner_id`,
    [courseId],
  );
}

export function listAudioAssets(
  db: Queryable,
  ownerType: AudioOwnerType,
  ownerId: number,
): Promise<AudioAssetPathRow[]> {
  return query<AudioAssetPathRow>(
    db,
    `SELECT path, origin, voice, text_hash FROM audio_assets
      WHERE owner_type = $1 AND owner_id = $2`,
    [ownerType, ownerId],
  );
}

/** Records a generated clip, replacing the stale one for this voice; uploads are never touched. */
export async function upsertGeneratedAudio(
  db: Queryable,
  clip: {
    ownerType: AudioOwnerType;
    ownerId: number;
    voice: string;
    path: string;
    textHash: string;
  },
): Promise<void> {
  await query(
    db,
    `INSERT INTO audio_assets (owner_type, owner_id, voice, path, origin, text_hash)
     VALUES ($1, $2, $3, $4, 'generated', $5)
     ON CONFLICT (owner_type, owner_id, voice, origin)
     DO UPDATE SET path = EXCLUDED.path, text_hash = EXCLUDED.text_hash, created_at = now()`,
    [clip.ownerType, clip.ownerId, clip.voice, clip.path, clip.textHash],
  );
}

/** FR-077: the stored Hanzi Writer stroke data of the item with this key, or null. */
export async function findStrokeData(db: Queryable, itemKey: string): Promise<StrokeData | null> {
  const row = await queryOne<{ strokes: StrokeData }>(
    db,
    `SELECT s.strokes FROM stroke_data s JOIN items i ON i.id = s.item_id WHERE i.key = $1`,
    [itemKey],
  );
  return row?.strokes ?? null;
}

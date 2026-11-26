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

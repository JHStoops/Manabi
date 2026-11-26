import type { Tile } from '@manabi/core';
import type { AudioOrigin } from '../content/rows';

/** What a clip is generated from: an item's reading, or a sentence's tiles. */
export interface AudioOwnerRow {
  plugin: string;
  /** Written form, for logs and plugins whose engine reads it. */
  text: string;
  /** Items only. */
  reading: string | null;
  /** Sentences only. */
  tiles: Tile[] | null;
}

export interface AudioAssetPathRow {
  path: string;
  origin: AudioOrigin;
  voice: string | null;
  text_hash: string;
}

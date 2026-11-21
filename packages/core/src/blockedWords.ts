import type { Tile } from './sentence';

/**
 * FR-237: the blocklist words found in a sentence's or answer text's tiles, matched on each
 * tile's base form and surface, so a blocked verb is found in its conjugated forms. The tiles
 * come from the language plugin (`segment`, or `tokenize` for stored tiles); this check itself
 * is language-neutral. Shared by the Tatoeba import, the pack lint and the authoring writes.
 */
export function findBlockedWords(
  tiles: readonly Pick<Tile, 'surface' | 'base'>[],
  blocked: ReadonlySet<string>,
): string[] {
  return [...new Set(tiles.flatMap((t) => [t.base, t.surface]).filter((w) => blocked.has(w)))];
}

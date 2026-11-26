import type { Annotation, Item, ReadingAnnotationMode, Tile } from '@manabi/core';
import { effective } from './generators';
import { kanjiDataSchema } from './itemSchemas';

const KANJI = /\p{Script=Han}/u;

/**
 * FR-140, Product Spec section 8: furigana for a sentence's stored tiles. Each annotation covers
 * a tile's kanji with the tile's stored reading, minus the kana the surface already shows at its
 * start and end (食べる → 食: た). `learnedItems` are the learner's items at stage 4 or above; in
 * `unlearned` mode a tile is annotated only when it holds a kanji not among them.
 */
export function annotate(
  tiles: readonly Tile[],
  learnedItems: Item[],
  mode: ReadingAnnotationMode,
): Annotation[] {
  if (mode === 'never') return [];
  const learned = new Set(
    learnedItems
      .filter((item) => item.type === 'kanji')
      .map((item) => kanjiDataSchema.safeParse(effective(item)).data?.character),
  );
  const annotations: Annotation[] = [];
  let offset = 0;
  for (const { surface, reading } of tiles) {
    const kanji = [...surface].filter((char) => KANJI.test(char));
    // Fallback tiles have the surface as their reading; they never get furigana (SDD section 4).
    const show =
      kanji.length > 0 &&
      reading !== surface &&
      (mode === 'always' || kanji.some((char) => !learned.has(char)));
    if (show) {
      let start = 0;
      let end = surface.length;
      let value = reading;
      // shortcut: kana between two kanji (取り消す) stays under one reading; split per kanji
      // if authors ask for finer furigana.
      while (start < end && !KANJI.test(surface[start]!) && value[0] === surface[start]) {
        start++;
        value = value.slice(1);
      }
      while (end > start && !KANJI.test(surface[end - 1]!) && value.at(-1) === surface[end - 1]) {
        end--;
        value = value.slice(0, -1);
      }
      if (value)
        annotations.push({ start: offset + start, end: offset + end, kind: 'furigana', value });
    }
    offset += surface.length;
  }
  return annotations;
}

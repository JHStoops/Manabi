import type { Tile, TokenizeInput } from '@manabi/core';

/** A run class for the fallback split. `extend` joins the run before it; `gap` is never a tile. */
type CharClass = 'hiragana' | 'katakana' | 'kanji' | 'latin' | 'digit' | 'other' | 'extend' | 'gap';

// The prolonged sound mark (ー, ｰ) and the voicing marks belong to the Common script but continue
// the kana run they follow (らーめん, ラーメン).
// A Set, not a character class: U+3099 and U+309A are combining marks.
const extendMarks = new Set(['ー', 'ｰ', '゙', '゚', '゛', '゜', 'ﾞ', 'ﾟ']);

function classify(char: string): CharClass {
  if (extendMarks.has(char)) return 'extend';
  if (/\p{Script=Hiragana}/u.test(char)) return 'hiragana';
  if (/\p{Script=Katakana}/u.test(char)) return 'katakana';
  // Han includes the iteration mark 々 and 〆.
  if (/\p{Script=Han}/u.test(char)) return 'kanji';
  if (/\p{Nd}/u.test(char)) return 'digit';
  if (/\p{Script=Latin}/u.test(char)) return 'latin';
  // Whitespace, punctuation, symbols and controls separate runs; punctuation is not a tile (DR-12).
  if (/[\p{White_Space}\p{P}\p{S}\p{C}]/u.test(char)) return 'gap';
  return 'other';
}

/**
 * Last-resort split for text with no stored tiles: one tile per run of the same script
 * (hiragana, katakana, kanji, Latin, digits, anything else), dropping whitespace, punctuation and
 * symbols. There is no dictionary here, so each tile's base form and reading are its surface:
 * a kanji run's "reading" is not kana. Real tiles come from `segment` at import (FR-238).
 */
export function splitByScript(text: string): Tile[] {
  const tiles: Tile[] = [];
  let surface = '';
  let current: CharClass | null = null;
  const flush = (): void => {
    if (surface) tiles.push({ surface, base: surface, reading: surface });
    surface = '';
    current = null;
  };
  for (const char of text) {
    let cls = classify(char);
    if (cls === 'extend') cls = current ?? 'katakana';
    if (cls === 'gap') {
      flush();
      continue;
    }
    if (cls !== current) flush();
    current = cls;
    surface += char;
  }
  flush();
  return tiles;
}

/**
 * SDD section 4: the tiles stored with a sentence or answer text, unchanged; only when none are
 * stored, the script-run fallback.
 */
export function tokenize({ text, tiles }: TokenizeInput): Tile[] {
  return tiles && tiles.length > 0 ? [...tiles] : splitByScript(text);
}

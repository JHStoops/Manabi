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
  // Han includes the iteration mark 々; 〆 is Common script but reads as a kanji.
  if (/[\p{Script=Han}〆]/u.test(char)) return 'kanji';
  if (/\p{Nd}/u.test(char)) return 'digit';
  if (/\p{Script=Latin}/u.test(char)) return 'latin';
  // Whitespace, punctuation, symbols and controls separate runs; punctuation is not a tile (DR-12).
  if (/[\p{White_Space}\p{P}\p{S}\p{C}]/u.test(char)) return 'gap';
  return 'other';
}

/** Separators that stay inside a number when they sit between two digits (1,000 or 3.5). */
const numberSeparators = new Set([',', '.', '，', '．']);

/**
 * Last-resort split for text with no stored tiles: one tile per run of the same script
 * (hiragana, katakana, kanji, Latin, digits, anything else), dropping whitespace, punctuation and
 * symbols. Real tiles come from `segment` at import (FR-238).
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
  const chars = [...text];
  chars.forEach((char, i) => {
    const next = chars[i + 1];
    if (
      current === 'digit' &&
      numberSeparators.has(char) &&
      next !== undefined &&
      classify(next) === 'digit'
    ) {
      surface += char;
      return;
    }
    let cls = classify(char);
    if (cls === 'extend') cls = current ?? 'katakana';
    if (cls === 'gap') {
      flush();
      return;
    }
    if (cls !== current) flush();
    current = cls;
    surface += char;
  });
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

/** FR-136: the kana reading sent to TTS for a sentence or answer: its tiles' readings joined. */
export function readingOf(tiles: readonly Tile[]): string {
  return tiles.map((tile) => tile.reading).join('');
}

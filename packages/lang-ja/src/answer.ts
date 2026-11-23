import type { AnswerContext, CheckResult, Exercise, Tile } from '@manabi/core';
import { answerCheckPayloadSchema } from '@manabi/core';
import { romajiToHiragana } from './romaji';

// FR-143, Product Spec section 4 (answer checking rules). Pure: runs unchanged in browser and Node.

const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー]/u;
const KANJI = /\p{Script=Han}/u;
const LATIN = /[a-z]/i;
const SPELLING_HINT = 'Watch your spelling';
// A one-letter typo in a shorter word is usually another word (cat, car), so it is not forgiven.
const MIN_TYPO_LENGTH = 4;

const isJapanese = (text: string) => JAPANESE.test(text);

/** Hiragana for katakana; everything else unchanged. */
const toHiragana = (text: string) =>
  text.replace(/[ァ-ヶ]/g, (k) => String.fromCodePoint(k.codePointAt(0)! - 0x60));

/**
 * Japanese: width folded (NFKC), romaji converted to hiragana, punctuation and spaces removed.
 * Kana stay as written: hiragana and katakana are not folded into each other.
 */
function normalizeJapanese(text: string): string {
  const folded = text.normalize('NFKC');
  return (LATIN.test(folded) ? romajiToHiragana(folded) : folded).replace(/[\p{P}\p{S}\s]/gu, '');
}

/** English: case, punctuation, extra spaces, and a leading "to" or article are ignored. */
function normalizeEnglish(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:(?:to|a|an|the) )+/, '');
}

/**
 * True when `given` spells the tiles in order, each word as written or, for a word with kanji, in
 * kana (its hiragana reading). `fold` is applied to both spellings.
 */
function spellsTiles(given: string, tiles: readonly Tile[], fold: (s: string) => string): boolean {
  const match = (i: number, pos: number): boolean => {
    if (i === tiles.length) return pos === given.length;
    const { surface, reading } = tiles[i]!;
    const forms = KANJI.test(surface) ? [surface, reading] : [surface];
    return forms
      .map((f) => fold(normalizeJapanese(f)))
      .some((f) => f !== '' && given.startsWith(f, pos) && match(i + 1, pos + f.length));
  };
  return tiles.length > 0 && match(0, 0);
}

/** True when `a` becomes `b` by one insertion, deletion, substitution or adjacent swap. */
function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length !== b.length) {
    const [long, short] = a.length > b.length ? [a, b] : [b, a];
    return long.slice(i + 1) === short.slice(i);
  }
  return (
    a.slice(i + 1) === b.slice(i + 1) ||
    (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
  );
}

const acceptOf = (exercise: Exercise) => answerCheckPayloadSchema.parse(exercise.payload);

/**
 * Canonical form of a typed answer. The exercise's accept list says whether the answer is
 * Japanese or English; without one, the text itself does.
 */
export function normalizeAnswer(text: string, context: AnswerContext): string {
  const japanese = context.exercise
    ? acceptOf(context.exercise).accept.some((a) => isJapanese(a.text))
    : isJapanese(text);
  return japanese ? normalizeJapanese(text) : normalizeEnglish(text);
}

/**
 * Checks a typed answer against the exercise's accept list. Japanese entries also accept each
 * word's kana spelling unless the exercise tests the kanji; romaji input matches either kana script.
 * English entries forgive a one-letter typo as a near-miss. Throws a ZodError on a payload
 * without an accept list.
 */
export function checkAnswer(given: string, exercise: Exercise): CheckResult {
  const { accept, testsKanji } = acceptOf(exercise);
  const japanese = accept.filter((a) => isJapanese(a.text));
  const english = accept.filter((a) => !isJapanese(a.text)).map((a) => normalizeEnglish(a.text));

  const ja = normalizeJapanese(given);
  // Romaji has no script, so it is compared with both kana folded to hiragana.
  const fold = LATIN.test(given.normalize('NFKC')) ? toHiragana : (s: string) => s;
  const jaMatch = japanese.some(
    (a) =>
      fold(normalizeJapanese(a.text)) === ja || (!testsKanji && spellsTiles(ja, a.tiles, fold)),
  );
  const en = normalizeEnglish(given);
  if ((ja !== '' && jaMatch) || (en !== '' && english.includes(en))) return { result: 'correct' };

  const typo = english.some((e) => e.length >= MIN_TYPO_LENGTH && oneEditApart(en, e));
  return typo ? { result: 'near-miss', hint: SPELLING_HINT } : { result: 'wrong' };
}

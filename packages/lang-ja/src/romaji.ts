import { courseKana } from './kana';

// FR-143: typed romaji (Hepburn, Nihon/Kunrei-shiki and common IME spellings) to hiragana.
// Characters that are not romaji pass through unchanged.

const VOWELS = 'aiueo';
const ROWS: Record<string, string> = {
  '': 'あ い う え お',
  k: 'か き く け こ',
  g: 'が ぎ ぐ げ ご',
  s: 'さ し す せ そ',
  z: 'ざ じ ず ぜ ぞ',
  t: 'た ち つ て と',
  d: 'だ ぢ づ で ど',
  n: 'な に ぬ ね の',
  h: 'は ひ ふ へ ほ',
  b: 'ば び ぶ べ ぼ',
  p: 'ぱ ぴ ぷ ぺ ぽ',
  m: 'ま み む め も',
  y: 'や い ゆ いぇ よ',
  r: 'ら り る れ ろ',
  w: 'わ うぃ う うぇ を',
  f: 'ふぁ ふぃ ふ ふぇ ふぉ',
  v: 'ゔぁ ゔぃ ゔ ゔぇ ゔぉ',
  j: 'じゃ じ じゅ じぇ じょ',
  sh: 'しゃ し しゅ しぇ しょ',
  ch: 'ちゃ ち ちゅ ちぇ ちょ',
  ts: 'つぁ つぃ つ つぇ つぉ',
  th: 'てゃ てぃ てゅ てぇ てょ',
  dh: 'でゃ でぃ でゅ でぇ でょ',
  x: 'ぁ ぃ ぅ ぇ ぉ',
  l: 'ぁ ぃ ぅ ぇ ぉ',
  xy: 'ゃ ぃ ゅ ぇ ょ',
  ly: 'ゃ ぃ ゅ ぇ ょ',
};
// Contracted sounds (kya, sho, ...): the row's i-kana plus a small ya, i, yu, e or yo.
for (const c of 'kgsztdnhbpmr')
  ROWS[`${c}y`] = 'ゃ ぃ ゅ ぇ ょ'.replace(/\S/g, (s) => ROWS[c]![2] + s);

const TABLE: Record<string, string> = { xtu: 'っ', ltu: 'っ', xtsu: 'っ', ltsu: 'っ', '-': 'ー' };
for (const [c, kana] of Object.entries(ROWS)) {
  kana.split(' ').forEach((k, i) => (TABLE[c + VOWELS[i]] = k));
}

const startsSyllable = (ch: string | undefined) => ch !== undefined && /[aiueoy]/.test(ch);

/** Converts romaji in `text` (lowercased first) to hiragana; everything else is kept. */
export function romajiToHiragana(text: string): string {
  const s = text.toLowerCase();
  let out = '';
  for (let i = 0; i < s.length;) {
    const ch = s[i]!;
    const next = s[i + 1];
    if (ch === 'n' && !startsSyllable(next)) {
      // ん: n, n' or nn not starting a syllable. "nn" before a vowel is ん + n-syllable.
      out += 'ん';
      i += next === "'" || (next === 'n' && !startsSyllable(s[i + 2])) ? 2 : 1;
      continue;
    }
    if (/[bcdfghjkmprstvwz]/.test(ch) && (next === ch || (ch === 't' && next === 'c'))) {
      out += 'っ'; // doubled consonant (kitte), or "tch" (matcha)
      i += 1;
      continue;
    }
    const len = [4, 3, 2, 1].find((n) => TABLE[s.slice(i, i + n)] !== undefined);
    if (len === undefined) {
      out += ch;
      i += 1;
    } else {
      out += TABLE[s.slice(i, i + len)];
      i += len;
    }
  }
  return out;
}

const KANA_ROMAJI = new Map(courseKana.map((k) => [k.character, k.romaji]));

/**
 * FR-141: Hepburn romaji for a kana reading, shown only in the kana section (いぬ → inu, きょう →
 * kyou, まっちゃ → matcha, コーヒー → koohii).
 * shortcut: small vowel kana (ティ) stay as kana, ん before a vowel gets no apostrophe and a
 * trailing っ (あっ) stays as kana; upgrade when kana-section words use them.
 */
export function kanaToRomaji(kana: string): string {
  let out = '';
  for (const ch of kana) {
    const small = 'ゃゅょャュョ'.indexOf(ch);
    if (small >= 0 && out.endsWith('i')) {
      // A contracted sound: ki + ゃ → kya, shi + ゃ → sha.
      const stem = out.slice(0, -1);
      out = (/(sh|ch|j)$/.test(stem) ? stem : `${stem}y`) + 'auo'[small % 3]!;
    } else if (ch === 'ー') {
      out += out.at(-1) ?? '';
    } else {
      out += KANA_ROMAJI.get(ch) ?? ch;
    }
  }
  // A small tsu doubles the next consonant (kitte), written t before ch (matcha).
  return out.replace(/[っッ]([a-z])/g, (_, c: string) => (c === 'c' ? 't' : c) + c);
}

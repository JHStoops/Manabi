import { romajiToHiragana } from './romaji';

// Each katakana sits 0x60 code points after its hiragana (ー is shared).
const toKatakana = (s: string) =>
  s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

/**
 * FR-142: live romaji to kana for a field the learner is typing in. Safe to run again on its own
 * output. A romaji word starting with a capital becomes katakana ("KA", "Ka" -> カ), otherwise
 * hiragana. A trailing "n" or "nn" stays as typed, since a vowel may follow ("nna" is んな).
 */
export function convertInput(text: string, mode: string): string {
  if (mode !== 'romaji') return text;
  // shortcut: case is read per word, so hiragana and katakana mix only across a space or other non-letter
  // ("Ka na"); upgrade if learners need shift on single syllables inside a word.
  return text.replace(/[A-Za-z'-]+/g, (word, offset: number) => {
    const pending =
      offset + word.length === text.length ? (/(?<![nN])[nN]{1,2}$/.exec(word)?.[0] ?? '') : '';
    const kana = romajiToHiragana(word.slice(0, word.length - pending.length));
    // Letters not yet converted keep their case (upper-cased), or the next key would read as hiragana.
    return (/^[A-Z]/.test(word) ? toKatakana(kana).toUpperCase() : kana) + pending;
  });
}

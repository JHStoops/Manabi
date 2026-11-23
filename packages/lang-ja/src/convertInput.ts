import { romajiToHiragana } from './romaji';

// Each katakana sits 0x60 code points after its hiragana (ー is shared).
const toKatakana = (s: string) =>
  s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

/**
 * FR-142: live romaji to kana for a field the learner is typing in. Safe to run again on its own
 * output. A romaji word starting with a capital becomes katakana ("KA", "Ka" -> カ), otherwise
 * hiragana. A lone "n" at the very end stays as typed, since "na" may follow.
 */
export function convertInput(text: string, mode: string): string {
  if (mode !== 'romaji') return text;
  // shortcut: case is read per word, so hiragana and katakana mix only across a space or other non-letter
  // ("Ka na"); upgrade if learners need shift on single syllables inside a word.
  return text.replace(/[A-Za-z'-]+/g, (word, offset: number) => {
    const pending = offset + word.length === text.length && /(^|[^nN])[nN]$/.test(word);
    const body = pending ? word.slice(0, -1) : word;
    const kana = romajiToHiragana(body);
    return (/^[A-Z]/.test(word) ? toKatakana(kana) : kana) + (pending ? word.slice(-1) : '');
  });
}

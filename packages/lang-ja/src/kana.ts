import type { KanaData } from './itemSchemas';

// The single-character kana the course teaches: the 46 basic hiragana and their 25 voiced forms,
// in gojuon order, with Hepburn romaji (を as "wo", as typed). Katakana mirror them.
const HIRAGANA =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん' +
  'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';
const ROMAJI = `a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no
  ha hi fu he ho ma mi mu me mo ya yu yo ra ri ru re ro wa wo n
  ga gi gu ge go za ji zu ze zo da ji zu de do ba bi bu be bo pa pi pu pe po`.split(/\s+/);

/** Every kana item of the course: hiragana first, then katakana, each in gojuon order. */
export const courseKana: KanaData[] = (['hiragana', 'katakana'] as const).flatMap((script) =>
  [...HIRAGANA].map((h, i) => ({
    // Each katakana sits 0x60 code points after its hiragana.
    character: script === 'hiragana' ? h : String.fromCodePoint(h.codePointAt(0)! + 0x60),
    script,
    romaji: ROMAJI[i]!,
  })),
);

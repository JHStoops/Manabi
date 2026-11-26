// FR-043, FR-049: Japanese conjugation rules, keyed by JMdict part-of-speech codes. They work on
// the written form and on the kana reading alike, since only the kana ending changes.

export const CONJUGATION_FORMS = [
  'masu',
  'masen',
  'mashita',
  'te',
  'ta',
  'nai',
  'nakatta',
] as const;
export type ConjugationForm = (typeof CONJUGATION_FORMS)[number];

/** What the exercise prompt calls each form. */
export const FORM_LABELS: Record<ConjugationForm, string> = {
  masu: 'Polite (ます form)',
  masen: 'Polite negative (ません form)',
  mashita: 'Polite past (ました form)',
  te: 'Te-form',
  ta: 'Plain past (た form)',
  nai: 'Plain negative (ない form)',
  nakatta: 'Plain negative past (なかった form)',
};

/** Rows of the godan ending: dictionary (u), stem before ます (i), before ない (a), te and ta. */
const GODAN: Record<string, { i: string; a: string; te: string; ta: string }> = {
  う: { i: 'い', a: 'わ', te: 'って', ta: 'った' },
  つ: { i: 'ち', a: 'た', te: 'って', ta: 'った' },
  る: { i: 'り', a: 'ら', te: 'って', ta: 'った' },
  む: { i: 'み', a: 'ま', te: 'んで', ta: 'んだ' },
  ぶ: { i: 'び', a: 'ば', te: 'んで', ta: 'んだ' },
  ぬ: { i: 'に', a: 'な', te: 'んで', ta: 'んだ' },
  く: { i: 'き', a: 'か', te: 'いて', ta: 'いた' },
  ぐ: { i: 'ぎ', a: 'が', te: 'いで', ta: 'いだ' },
  す: { i: 'し', a: 'さ', te: 'して', ta: 'した' },
};

const GODAN_ENDING: Record<string, string> = {
  u: 'う',
  t: 'つ',
  r: 'る',
  a: 'る',
  m: 'む',
  b: 'ぶ',
  n: 'ぬ',
  k: 'く',
  g: 'ぐ',
  s: 'す',
};

const POLITE = { masu: 'ます', masen: 'ません', mashita: 'ました' } as const;

type Stems = { polite: string; nai: string; te: string; ta: string };

/** The four stems a verb's forms hang on: before ます, before ない, and the te and ta forms. */
function verbStems(text: string, pos: string): Stems | undefined {
  const last = text.slice(-1);
  const head = text.slice(0, -1);
  if (pos === 'v1' || pos === 'v1-s') {
    return last === 'る'
      ? { polite: head, nai: head, te: `${head}て`, ta: `${head}た` }
      : undefined;
  }
  if (pos === 'vs-i' || pos === 'vs-s') {
    if (!text.endsWith('する')) return undefined;
    const h = text.slice(0, -2);
    return { polite: `${h}し`, nai: `${h}し`, te: `${h}して`, ta: `${h}した` };
  }
  if (pos === 'vk') {
    // 来 stays as written; the kana spelling くる changes く to き or こ.
    if (last !== 'る' || !/[来く]$/u.test(head)) return undefined;
    const [base, kanji] = [head.slice(0, -1), head.endsWith('来')];
    const stem = (kana: string) => (kanji ? head : `${base}${kana}`);
    return { polite: stem('き'), nai: stem('こ'), te: `${stem('き')}て`, ta: `${stem('き')}た` };
  }
  const row = GODAN[last];
  // The code names the ending: v5k a verb in く, v5aru one in る.
  if (!row || !pos.startsWith('v5') || GODAN_ENDING[pos.slice(2, 3)] !== last) return undefined;
  const stems = {
    polite: `${head}${pos === 'v5aru' ? 'い' : row.i}`,
    nai: `${head}${row.a}`,
    te: `${head}${row.te}`,
    ta: `${head}${row.ta}`,
  };
  // 行く: the te and ta forms are いって and いった.
  if (pos === 'v5k-s') return { ...stems, te: `${head}って`, ta: `${head}った` };
  // 問う: the te and ta forms are とうて and とうた.
  if (pos === 'v5u-s') return { ...stems, te: `${text}て`, ta: `${text}た` };
  // ある has no ない stem: its negative is just ない.
  return pos === 'v5r-i' ? { ...stems, nai: '' } : stems;
}

const VERB_FORMS: Record<ConjugationForm, (s: Stems) => string> = {
  masu: (s) => `${s.polite}${POLITE.masu}`,
  masen: (s) => `${s.polite}${POLITE.masen}`,
  mashita: (s) => `${s.polite}${POLITE.mashita}`,
  te: (s) => s.te,
  ta: (s) => s.ta,
  nai: (s) => `${s.nai}ない`,
  nakatta: (s) => `${s.nai}なかった`,
};

// shortcut: polite forms of adjectives and the plain non-past are not generated; upgrade when a
// grammar point drills them.
const ADJ_I_ENDINGS: Partial<Record<ConjugationForm, string>> = {
  te: 'くて',
  ta: 'かった',
  nai: 'くない',
  nakatta: 'くなかった',
};
const ADJ_NA_ENDINGS: Partial<Record<ConjugationForm, string>> = {
  te: 'で',
  ta: 'だった',
  nai: 'ではない',
  nakatta: 'ではなかった',
};

const VERB_CODES = new Set(
  'v1 v1-s vs-i vs-s vk v5aru v5b v5g v5k v5k-s v5m v5n v5r v5r-i v5s v5t v5u v5u-s'.split(' '),
);
/** Whether a word with this JMdict part-of-speech code can be conjugated at all. */
export const isConjugable = (pos: string) =>
  VERB_CODES.has(pos) || pos === 'adj-i' || pos === 'adj-ix' || pos === 'adj-na';

/** Forms generated for a part-of-speech code; empty when it is unsupported. */
export function formsFor(pos: string): ConjugationForm[] {
  if (!isConjugable(pos)) return [];
  if (pos.startsWith('adj')) return ['te', 'ta', 'nai', 'nakatta'];
  return [...CONJUGATION_FORMS];
}

/**
 * `text` (a dictionary form, written or kana) in `form`, or undefined when the part-of-speech
 * code is unsupported, the form does not exist for it, or the text does not end as the class
 * requires.
 */
export function conjugate(text: string, pos: string, form: ConjugationForm): string | undefined {
  if (!formsFor(pos).includes(form)) return undefined;
  if (pos === 'adj-na') return `${text}${ADJ_NA_ENDINGS[form]}`;
  if (pos === 'adj-i' || pos === 'adj-ix') {
    if (!text.endsWith('い')) return undefined;
    // いい (良い) is conjugated from よ: よくない, よかった.
    const stem =
      pos === 'adj-ix' && text.endsWith('いい') ? `${text.slice(0, -2)}よ` : text.slice(0, -1);
    return `${stem}${ADJ_I_ENDINGS[form]}`;
  }
  const stems = verbStems(text, pos);
  return stems && VERB_FORMS[form](stems);
}

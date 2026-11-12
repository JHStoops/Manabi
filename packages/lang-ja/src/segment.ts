import type { AnalyzerToken, SegmentedTile } from '@manabi/core';

// FR-238: merge rules over kuromoji (IPADIC) tokens, ported from spikes/word-boundaries/rules.ts.
// Rule ids (R0 to R10) and the tile spec (T1 to T11) are in docs/spikes/word-boundaries.md.

type Kind =
  | 'verb'
  | 'adj'
  | 'noun'
  | 'sahen'
  | 'num'
  | 'prefix'
  | 'copula'
  | 'nominalizer'
  | 'particle'
  | 'other';

type Draft = { surface: string; base: string; reading: string; kind: Kind; counted: boolean };

const REQUEST_VERBS = new Set(['ください', '下さい', 'くださる', '下さる']);
const COPULA = new Set(['だ', 'です']);
const SEPARATE_AUX = new Set(['べし']);
const TE_LIKE = new Set(['て', 'で', 'ば', 'たり', 'ながら', 'ちゃ', 'じゃ', 'つつ']);
const VERB_LIKE: Kind[] = ['verb', 'adj'];

const token = (surface: string, pos: string[], baseForm: string, reading: string) => ({
  surface,
  pos,
  conjugationType: null,
  conjugationForm: null,
  baseForm,
  reading,
});
const ki = token('気', ['名詞', '一般'], '気', 'キ');
const caseParticle = (p: string, r: string) => token(p, ['助詞', '格助詞', '一般'], p, r);
const verbTail = (base: string) => token('', ['動詞', '自立'], base, '');

/**
 * Idioms IPADIC stores as one word, keyed by base form, split back into the words a learner taps
 * (spike: "Split dictionary idioms"). The last part takes the rest of the surface, reading and
 * conjugation, so 気がついた splits as 気 | が | つい (+ た).
 */
const IDIOM_SPLITS: Record<string, AnalyzerToken[]> = {
  気がつく: [ki, caseParticle('が', 'ガ'), verbTail('つく')],
  気に入る: [ki, caseParticle('に', 'ニ'), verbTail('入る')],
  後で: [token('後', ['名詞', '一般'], '後', 'アト'), caseParticle('で', 'デ')],
};

function splitIdiom(t: AnalyzerToken): AnalyzerToken[] {
  const parts = t.baseForm === null ? undefined : IDIOM_SPLITS[t.baseForm];
  if (!parts) return [t];
  const heads = parts.slice(0, -1);
  const tail = parts[parts.length - 1]!;
  const headSurface = heads.map((h) => h.surface).join('');
  const headReading = heads.map((h) => h.reading).join('');
  if (!t.surface.startsWith(headSurface) || t.surface === headSurface) return [t];
  const reading = t.reading?.startsWith(headReading) ? t.reading.slice(headReading.length) : null;
  return [
    ...heads,
    {
      ...t,
      pos: tail.pos,
      surface: t.surface.slice(headSurface.length),
      baseForm: tail.baseForm,
      reading: reading || null,
    },
  ];
}

const toHiragana = (text: string): string =>
  text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const isCopulaStart = (t: AnalyzerToken | undefined): boolean =>
  !!t &&
  ((t.pos[0] === '助動詞' && COPULA.has(t.baseForm ?? '')) ||
    (t.pos[0] === '助詞' && (t.surface === 'じゃ' || t.surface === 'では')));

const isNaiOrAru = (t: AnalyzerToken | undefined): boolean =>
  t?.baseForm === 'ない' || t?.baseForm === 'ある';

const KIND_BY_POS: Record<string, Kind> = { 名詞: 'noun', 動詞: 'verb', 形容詞: 'adj' };

/**
 * FR-238: tiles for one sentence or answer text from its kuromoji-ipadic tokens. Each tile's
 * reading is in hiragana; `counted` is false for particles, auxiliaries and the copula, numbers
 * with their counters, and person and place names (FR-235).
 */
export function segment(input: readonly AnalyzerToken[]): SegmentedTile[] {
  const tokens = input.flatMap(splitIdiom);
  const tiles: Draft[] = [];
  let prev: Draft | null = null;

  const push = (t: AnalyzerToken, kind: Kind, counted = true): void => {
    prev = {
      surface: t.surface,
      base: t.baseForm ?? t.surface,
      reading: t.reading ?? t.surface,
      kind,
      counted,
    };
    tiles.push(prev);
  };
  // `joinBase`: the token adds to the word itself (お休み, 電話する), not just inflects it.
  const attach = (t: AnalyzerToken, kind?: Kind, joinBase = false): void => {
    const p = prev!;
    p.surface += t.surface;
    p.reading += t.reading ?? t.surface;
    if (joinBase) p.base += t.baseForm ?? t.surface;
    if (kind) p.kind = kind;
  };

  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    const p = prev as Draft | null;
    const [pos, pos1, pos2] = t.pos;

    // R0: punctuation is never a tile and breaks merging.
    if (pos === '記号') {
      prev = null;
      return;
    }
    // R1: a prefix (お, ご) joins the word after it, which then decides what can follow.
    if (p?.kind === 'prefix') return attach(t, KIND_BY_POS[pos ?? ''] ?? 'other', true);
    if (pos === '接頭詞') return push(t, 'prefix');

    if (pos === '名詞') {
      // R2: digits and kanji numerals run together; R3: counters / noun suffixes join the noun.
      if (pos1 === '数')
        return p?.kind === 'num' ? attach(t, undefined, true) : push(t, 'num', false);
      if (pos1 === '接尾' && (p?.kind === 'num' || p?.kind === 'noun' || p?.kind === 'sahen')) {
        // A number keeps its kind so a counter tile stays uncounted (三人, 一週間後); a name plus a
        // person suffix (ルーシーさん) stays a name; any other suffix makes a word (中国語).
        p.counted = p.counted || (p.kind !== 'num' && pos2 !== '人名');
        return attach(t, p.kind === 'num' ? undefined : 'noun', true);
      }
      if (pos1 === '接尾') return push(t, 'noun', false);
      // R8: a nominalizer の/ん after a verb or adjective joins a following copula (のです, んじゃない).
      if (
        pos1 === '非自立' &&
        (t.surface === 'の' || t.surface === 'ん') &&
        p &&
        VERB_LIKE.includes(p.kind) &&
        isCopulaStart(next)
      )
        return push(t, 'nominalizer', false);
      if (pos1 === 'サ変接続') return push(t, 'sahen');
      return push(t, 'noun', !(pos1 === '固有名詞' && (pos2 === '人名' || pos2 === '地域')));
    }

    if (pos === '動詞') {
      // R4: する after a サ変 noun makes one verb (電話します).
      if (t.baseForm === 'する' && p?.kind === 'sahen') return attach(t, 'verb', true);
      // R5: subsidiary verbs (いる/てる, くる, しまう, みる, なさい, すぎる, がる, ちゃう) join the verb,
      // but ください stays its own tile.
      if (REQUEST_VERBS.has(t.baseForm ?? '') || REQUEST_VERBS.has(t.surface))
        return push(t, 'verb');
      const subsidiary =
        pos1 === '非自立' || pos1 === '接尾' || ['ちゃう', 'じゃう'].includes(t.baseForm ?? '');
      if (subsidiary && p && VERB_LIKE.includes(p.kind)) return attach(t, 'verb');
      if (t.baseForm === 'すぎる' && p && VERB_LIKE.includes(p.kind)) return attach(t, 'verb');
      if (t.baseForm === 'すぎる' && p?.kind === 'noun') return attach(t, 'verb', true);
      return push(t, 'verb');
    }

    if (pos === '助動詞') {
      if (SEPARATE_AUX.has(t.baseForm ?? '')) return push(t, 'other', false);
      // R7: the copula is its own tile, with its own endings (でした, だろう, である, ではない).
      if (COPULA.has(t.baseForm ?? '')) {
        if (p?.kind === 'nominalizer') return attach(t, 'copula');
        if (p?.kind === 'copula' && !COPULA.has(p.surface)) return attach(t);
        return push(t, 'copula', false);
      }
      // R6: other auxiliaries (ます, た, ない, たい, せる, れる, う, ん) join the verb or adjective.
      if (p && (VERB_LIKE.includes(p.kind) || p.kind === 'copula')) return attach(t);
      return push(t, 'verb', false);
    }

    if (pos === '助詞') {
      // R6: て/で/ば/たり/ちゃ join the verb or adjective (食べて, 来なければ).
      if (pos1 === '接続助詞' && TE_LIKE.has(t.surface) && p && VERB_LIKE.includes(p.kind))
        return attach(t);
      // R10: ば after a copula joins it (ならば).
      if (pos1 === '接続助詞' && t.surface === 'ば' && p?.kind === 'copula') return attach(t);
      // R7: じゃ/では as copula (んじゃない, じゃない), and the は inside ではない.
      if (t.surface === 'じゃ' || t.surface === 'では') {
        if (p?.kind === 'nominalizer') return attach(t, 'copula');
        if (isNaiOrAru(next)) return push(t, 'copula', false);
      }
      // R7: IPADIC also tags the で of 学生ではない as a case particle.
      if (t.surface === 'で' && next?.surface === 'は' && isNaiOrAru(tokens[i + 2]))
        return push(t, 'copula', false);
      if (
        t.surface === 'は' &&
        p?.kind === 'copula' &&
        /(で|じゃ)$/.test(p.surface) &&
        isNaiOrAru(next)
      )
        return attach(t);
      // R9: every other particle is its own tile.
      return push(t, 'particle', false);
    }

    if (pos === '形容詞') return push(t, 'adj');
    return push(t, 'other');
  });

  return tiles.map(({ surface, base, reading, counted }) => ({
    surface,
    base,
    reading: toHiragana(reading),
    counted,
  }));
}

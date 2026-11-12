// Spike #4: post-processing rules that merge kuromoji (IPADIC) tokens into word-bank tiles.
// Rule ids (R1..R10) match docs/spikes/word-boundaries.md.

export type RawToken = {
  surface: string;
  pos: string;
  pos1: string;
  pos2: string;
  ctype: string;
  cform: string;
  base: string;
};

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

type Tile = { surface: string; kind: Kind };

const REQUEST_VERBS = new Set(['ください', '下さい', 'くださる', '下さる']);
const COPULA = new Set(['だ', 'です']);
const SEPARATE_AUX = new Set(['べし']);
const TE_LIKE = new Set(['て', 'で', 'ば', 'たり', 'ながら', 'ちゃ', 'じゃ', 'つつ']);
const VERB_LIKE: Kind[] = ['verb', 'adj'];

const isCopulaStart = (t: RawToken | undefined): boolean =>
  !!t &&
  ((t.pos === '助動詞' && COPULA.has(t.base)) ||
    (t.pos === '助詞' && (t.surface === 'じゃ' || t.surface === 'では')));

export function toTiles(tokens: RawToken[]): string[] {
  const tiles: Tile[] = [];
  let prev: Tile | null = null;

  const push = (surface: string, kind: Kind) => {
    prev = { surface, kind };
    tiles.push(prev);
  };
  const attach = (surface: string, kind?: Kind) => {
    prev!.surface += surface;
    if (kind) prev!.kind = kind;
  };

  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    const p = prev as Tile | null;

    // R0: punctuation is never a tile and breaks merging.
    if (t.pos === '記号') {
      prev = null;
      return;
    }
    // R1: a prefix (お, ご) joins the word after it.
    if (p?.kind === 'prefix') return attach(t.surface, t.pos === '名詞' ? 'noun' : undefined);
    if (t.pos === '接頭詞') return push(t.surface, 'prefix');

    if (t.pos === '名詞') {
      // R2: digits and kanji numerals run together; R3: counters / noun suffixes join the noun.
      if (t.pos1 === '数') return p?.kind === 'num' ? attach(t.surface) : push(t.surface, 'num');
      if (t.pos1 === '接尾' && (p?.kind === 'num' || p?.kind === 'noun' || p?.kind === 'sahen'))
        return attach(t.surface, 'noun');
      // R8: a nominalizer の/ん after a verb or adjective joins a following copula (のです, んじゃない).
      if (
        t.pos1 === '非自立' &&
        (t.surface === 'の' || t.surface === 'ん') &&
        p &&
        VERB_LIKE.includes(p.kind) &&
        isCopulaStart(next)
      )
        return push(t.surface, 'nominalizer');
      if (t.pos1 === 'サ変接続') return push(t.surface, 'sahen');
      return push(t.surface, 'noun');
    }

    if (t.pos === '動詞') {
      // R4: する after a サ変 noun makes one verb (電話します).
      if (t.base === 'する' && p?.kind === 'sahen') return attach(t.surface, 'verb');
      // R5: subsidiary verbs (いる/てる, くる, しまう, みる, なさい, すぎる, がる, ちゃう) join the verb,
      // but ください stays its own tile.
      if (REQUEST_VERBS.has(t.base) || REQUEST_VERBS.has(t.surface)) return push(t.surface, 'verb');
      const subsidiary =
        t.pos1 === '非自立' || t.pos1 === '接尾' || ['ちゃう', 'じゃう'].includes(t.base);
      if (subsidiary && p && VERB_LIKE.includes(p.kind)) return attach(t.surface, 'verb');
      if (t.base === 'すぎる' && p && (VERB_LIKE.includes(p.kind) || p.kind === 'noun'))
        return attach(t.surface, 'verb');
      return push(t.surface, 'verb');
    }

    if (t.pos === '助動詞') {
      if (SEPARATE_AUX.has(t.base)) return push(t.surface, 'other');
      // R7: the copula is its own tile, with its own endings (でした, だろう, である, ではない).
      if (COPULA.has(t.base)) {
        if (p?.kind === 'nominalizer') return attach(t.surface, 'copula');
        if (p?.kind === 'copula' && !COPULA.has(p.surface)) return attach(t.surface);
        return push(t.surface, 'copula');
      }
      // R6: other auxiliaries (ます, た, ない, たい, せる, れる, う, ん) join the verb or adjective.
      if (p && (VERB_LIKE.includes(p.kind) || p.kind === 'copula')) return attach(t.surface);
      return push(t.surface, 'verb');
    }

    if (t.pos === '助詞') {
      // R6: て/で/ば/たり/ちゃ join the verb or adjective (食べて, 来なければ).
      if (t.pos1 === '接続助詞' && TE_LIKE.has(t.surface) && p && VERB_LIKE.includes(p.kind))
        return attach(t.surface);
      // R7: じゃ/では as copula (んじゃない, じゃない), and the は inside ではない.
      if (t.surface === 'じゃ' || t.surface === 'では') {
        if (p?.kind === 'nominalizer') return attach(t.surface, 'copula');
        if (next && (next.base === 'ない' || next.base === 'ある'))
          return push(t.surface, 'copula');
      }
      if (
        t.surface === 'は' &&
        p?.kind === 'copula' &&
        /(で|じゃ)$/.test(p.surface) &&
        next &&
        (next.base === 'ない' || next.base === 'ある')
      )
        return attach(t.surface);
      // R9: every other particle is its own tile.
      return push(t.surface, 'particle');
    }

    if (t.pos === '形容詞') return push(t.surface, 'adj');
    return push(t.surface, 'other');
  });

  return tiles.map((t) => t.surface);
}

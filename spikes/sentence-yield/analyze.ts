/**
 * Throwaway spike script for issue #3 (Spike: measure Tatoeba sentence yield and quality).
 * Not part of any workspace; not imported by app code. See README.md next to this file.
 *
 * Run (Node 24 strips TypeScript types natively):
 *   node spikes/sentence-yield/analyze.ts
 *
 * Inputs (never committed) live in ~/.cache/manabi-spikes/ (override with MANABI_SPIKE_CACHE):
 *   tatoeba/jpn_sentences_detailed.tsv, tatoeba/eng_sentences_detailed.tsv,
 *   tatoeba/jpn-eng_links.tsv, tatoeba/user_languages_x/user_languages.csv,
 *   tanos/n5_vocab_wayback.html, tanos/n4_vocab_wayback.html,
 *   sentence-yield-deps/node_modules/kuromoji (npm install kuromoji@0.1.2 there).
 * Outputs (small, committed): spikes/sentence-yield/output/*.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE = process.env.MANABI_SPIKE_CACHE ?? join(homedir(), '.cache', 'manabi-spikes');
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'output');
const LENGTH_LIMITS = [10, 15, 20] as const;
const SAMPLE_SEED = 3; // issue number
const SAMPLE_SIZE = 50;
const SAMPLE_LIMIT = 15; // length limit used for the rated sample (the recommended one)

type Level = 'N5' | 'N4';
interface VocabEntry {
  id: string;
  level: Level;
  kanji: string;
  kana: string;
  english: string;
  forms: string[];
}
interface KToken {
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  basic_form: string;
  reading?: string;
  word_type: string;
}
interface Tokenizer {
  tokenize(text: string): KToken[];
}

// ---------- level lists ----------

const kataToHira = (s: string): string =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

function splitForms(cell: string): string[] {
  const parts = cell
    .replace(/・/g, '')
    .split(/[/／、,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  // "堅/硬/固い": earlier parts share the kana tail of the last part.
  const last = parts[parts.length - 1] ?? '';
  const tail = /[぀-ゟ]+$/.exec(last)?.[0] ?? '';
  return parts.map((p) => (tail && !/[぀-ゟ]$/.test(p) ? p + tail : p));
}

function expandForm(f: string): string[] {
  const out = new Set([f]);
  for (const suffix of ['する', 'な', 'に']) {
    if (f.endsWith(suffix) && f.length > suffix.length) out.add(f.slice(0, -suffix.length));
  }
  if (/^[おご]./.test(f)) out.add(f.slice(1));
  return [...out];
}

function parseTanos(file: string, level: Level): VocabEntry[] {
  const html = readFileSync(file, 'utf8');
  const rows = [...html.matchAll(/<tr><td>(.*?)<\/td><td>(.*?)<\/td><td>(.*?)<\/td><\/tr>/g)];
  return rows.map((m, i) => {
    const clean = (s: string | undefined): string =>
      (s ?? '')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .trim();
    const kanji = clean(m[1]);
    const kana = clean(m[2]);
    const forms = [...splitForms(kanji), ...splitForms(kana)].flatMap(expandForm);
    return { id: `${level}-${i}`, level, kanji, kana, english: clean(m[3]), forms };
  });
}

// ---------- tokenisation and coverage ----------

/** Tokens that are grammar, names or numbers rather than vocabulary to be taught. */
function isContentToken(t: KToken): boolean {
  const skipPos = ['助詞', '助動詞', '記号', 'フィラー', '接頭詞'];
  if (skipPos.includes(t.pos)) return false;
  if (t.pos === '名詞' && ['数', '非自立', '特殊'].includes(t.pos_detail_1)) return false;
  // Counters and name/place suffixes are grammar; other suffixes (酔い, 製) must be known words.
  if (t.pos === '名詞' && t.pos_detail_1 === '接尾') {
    if (['助数詞', '人名', '地域', '特殊', '助動詞語幹'].includes(t.pos_detail_2)) return false;
    if (SUFFIX_WHITELIST.has(t.basic_form)) return false;
  }
  // Person and place names are allowed; other proper nouns (organisations, events) must match.
  if (
    t.pos === '名詞' &&
    t.pos_detail_1 === '固有名詞' &&
    ['人名', '地域'].includes(t.pos_detail_2)
  )
    return false;
  if ((t.pos === '動詞' || t.pos === '形容詞') && ['非自立', '接尾'].includes(t.pos_detail_1))
    return false;
  return true;
}

/** Productive suffixes taught as grammar rather than vocabulary. */
const SUFFIX_WHITELIST = new Set([
  'たち',
  '達',
  'ら',
  '中',
  'じゅう',
  'ちゅう',
  '方',
  'かた',
  '屋',
  'や',
  '語',
  'ごろ',
  '頃',
  'ぐらい',
  'くらい',
]);

/** Minimal grammar whitelist: words the lists omit because they are taught as grammar. */
const GRAMMAR_WHITELIST = new Set(['ない', '無い']);

// ---------- seeded random ----------

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- main ----------

function readTsv(file: string): string[][] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'));
}

async function main(): Promise<void> {
  const loadDep = createRequire(join(CACHE, 'sentence-yield-deps', 'package.json'));
  const kuromoji = loadDep('kuromoji') as {
    builder(o: { dicPath: string }): {
      build(cb: (err: Error | null, t: Tokenizer) => void): void;
    };
  };
  const dicPath = join(CACHE, 'sentence-yield-deps', 'node_modules', 'kuromoji', 'dict');
  const tokenizer = await new Promise<Tokenizer>((resolve, reject) =>
    kuromoji.builder({ dicPath }).build((err, t) => (err ? reject(err) : resolve(t))),
  );

  const vocab = [
    ...parseTanos(join(CACHE, 'tanos', 'n5_vocab_wayback.html'), 'N5'),
    ...parseTanos(join(CACHE, 'tanos', 'n4_vocab_wayback.html'), 'N4'),
  ];
  // form -> entries; kana-only entries also indexed by reading for kanji-written lemmas.
  const byForm = new Map<string, VocabEntry[]>();
  const kanaOnly = new Map<string, VocabEntry[]>();
  for (const e of vocab) {
    for (const f of e.forms) {
      // Single-kana readings of kanji entries (九 く, 四 し, 二 に) collide with grammar; skip them.
      if (e.kanji && /^[\u3040-\u309f]$/.test(f)) continue;
      byForm.set(f, [...(byForm.get(f) ?? []), e]);
    }
    if (!e.kanji) for (const f of e.forms) kanaOnly.set(f, [...(kanaOnly.get(f) ?? []), e]);
  }
  const lemmaReadingCache = new Map<string, string>();
  const lemmaReading = (lemma: string): string => {
    let r = lemmaReadingCache.get(lemma);
    if (r === undefined) {
      const toks = tokenizer.tokenize(lemma);
      r = toks.length === 1 && toks[0]?.reading ? kataToHira(toks[0].reading) : '';
      lemmaReadingCache.set(lemma, r);
    }
    return r;
  };
  const matchToken = (t: KToken): VocabEntry[] => {
    const lemma = t.basic_form === '*' ? t.surface_form : t.basic_form;
    const direct = [
      ...(byForm.get(lemma) ?? []),
      ...(t.basic_form === '*' ? [] : (byForm.get(t.surface_form) ?? [])),
      ...(byForm.get(kataToHira(lemma)) ?? []),
    ];
    if (direct.length) return [...new Set(direct)];
    // Adverbs such as 本当に are one token; retry without the trailing に.
    if (t.pos === '副詞' && lemma.endsWith('に') && lemma.length > 1) {
      const stem = lemma.slice(0, -1);
      const viaStem = byForm.get(stem) ?? kanaOnly.get(lemmaReading(stem)) ?? [];
      if (viaStem.length) return viaStem;
    }
    const r = lemmaReading(lemma);
    return r ? (kanaOnly.get(r) ?? []) : [];
  };

  // Tatoeba
  const jpn = readTsv(join(CACHE, 'tatoeba', 'jpn_sentences_detailed.tsv'));
  const eng = new Map(
    readTsv(join(CACHE, 'tatoeba', 'eng_sentences_detailed.tsv')).map((r) => [r[0] ?? '', r]),
  );
  const links = new Map<string, string[]>();
  for (const [j, e] of readTsv(join(CACHE, 'tatoeba', 'jpn-eng_links.tsv'))) {
    if (j && e && eng.has(e)) links.set(j, [...(links.get(j) ?? []), e]);
  }
  const nativeJa = new Set(
    readTsv(join(CACHE, 'tatoeba', 'user_languages_x', 'user_languages.csv'))
      .filter((r) => r[0] === 'jpn' && r[1] === '5')
      .map((r) => r[2]),
  );

  interface Row {
    id: string;
    text: string;
    owner: string;
    ownerNative: boolean;
    engId: string;
    engText: string;
    engOwner: string;
    len: number;
    level: Level | 'above';
    unmatched: string[];
    entries: string[];
    hasProperNoun: boolean;
  }
  const seenText = new Set<string>();
  const rows: Row[] = [];
  let totalJpn = 0;
  let withEng = 0;
  let dupes = 0;
  let latin = 0;
  for (const [id, , text, owner] of jpn) {
    totalJpn++;
    if (!id || !text) continue;
    const engIds = links.get(id);
    if (!engIds?.length) continue;
    withEng++;
    if (seenText.has(text)) {
      dupes++;
      continue;
    }
    seenText.add(text);
    if (/[A-Za-zＡ-Ｚａ-ｚ]/.test(text)) {
      latin++;
      continue;
    }
    const engId = engIds
      .map(Number)
      .sort((a, b) => a - b)[0]!
      .toString();
    const engRow = eng.get(engId)!;
    const toks = tokenizer.tokenize(text);
    let worst: 0 | 1 | 2 = 0; // 0 = N5, 1 = N4, 2 = above
    const unmatched: string[] = [];
    const entries = new Set<string>();
    const credit = (m: VocabEntry[]): void => {
      for (const e of m) entries.add(e.id);
    };
    // Credit (never require) numbers, counters and compounds the tokenizer splits (映画館).
    for (const e of vocab)
      if (e.kanji.length >= 2 && !/[/\s]/.test(e.kanji) && text.includes(e.kanji)) credit([e]);
    for (const t of toks) {
      if (!isContentToken(t)) {
        if (t.pos === '名詞' && ['数', '接尾'].includes(t.pos_detail_1)) credit(matchToken(t));
        continue;
      }
      const lemma = t.basic_form === '*' ? t.surface_form : t.basic_form;
      if (GRAMMAR_WHITELIST.has(lemma)) continue;
      const m = matchToken(t);
      if (!m.length) {
        worst = 2;
        unmatched.push(lemma);
        continue;
      }
      const best = m.some((e) => e.level === 'N5') ? 0 : 1;
      if (best > worst) worst = best;
      credit(m.filter((e) => e.level === 'N5' || best === 1));
    }
    rows.push({
      id,
      text,
      owner: owner ?? '',
      ownerNative: nativeJa.has(owner),
      engId,
      engText: engRow[2] ?? '',
      engOwner: engRow[3] ?? '',
      len: text.replace(/[\s。、！？!?「」『』・…〜～,.]/g, '').length,
      level: worst === 0 ? 'N5' : worst === 1 ? 'N4' : 'above',
      unmatched,
      // Credited words above the sentence level are dropped (e.g. an N4 number word in an N5 sentence).
      entries: [...entries].filter((id) => worst !== 0 || id.startsWith('N5')),
      hasProperNoun: toks.some((t) => t.pos === '名詞' && t.pos_detail_1 === '固有名詞'),
    });
  }

  const atOrBelow = (r: Row, lvl: Level): boolean =>
    lvl === 'N5' ? r.level === 'N5' : r.level === 'N5' || r.level === 'N4';
  const counts: Record<string, Record<string, number>> = {};
  const perWord: Record<string, Record<string, number>> = {};
  for (const limit of [...LENGTH_LIMITS, Infinity]) {
    const key = limit === Infinity ? 'nolimit' : `le${limit}`;
    for (const lvl of ['N5', 'N4'] as Level[]) {
      for (const nativeOnly of [false, true]) {
        const surv = rows.filter(
          (r) => atOrBelow(r, lvl) && r.len <= limit && (!nativeOnly || r.ownerNative),
        );
        const k = `${lvl}${lvl === 'N4' ? '(cumulative)' : ''}_${key}${nativeOnly ? '_native' : ''}`;
        // per-word: for N5 words use N5 survivors; for N4 words use cumulative survivors
        const wordIds = vocab.filter((v) => v.level === lvl).map((v) => v.id);
        const c = new Map<string, number>(wordIds.map((w) => [w, 0]));
        for (const r of surv) for (const e of r.entries) if (c.has(e)) c.set(e, c.get(e)! + 1);
        const vals = [...c.values()];
        counts[k] = {
          sentences: surv.length,
          words: vals.length,
          wordsWith1: vals.filter((v) => v >= 1).length,
          wordsWith3: vals.filter((v) => v >= 3).length,
          wordsWith5: vals.filter((v) => v >= 5).length,
          withProperNoun: surv.filter((r) => r.hasProperNoun).length,
        };
        if (!nativeOnly) for (const [w, n] of c) (perWord[w] ??= {})[key] = n;
      }
    }
  }

  // unmatched lemmas among sentences that fail by exactly one word (diagnostic)
  const nearMiss = new Map<string, number>();
  for (const r of rows)
    if (r.level === 'above' && r.unmatched.length === 1 && r.len <= 15)
      nearMiss.set(r.unmatched[0]!, (nearMiss.get(r.unmatched[0]!) ?? 0) + 1);

  // rated sample: survivors at or below N4 (cumulative) with length <= SAMPLE_LIMIT
  const pool = rows.filter((r) => atOrBelow(r, 'N4') && r.len <= SAMPLE_LIMIT);
  const rand = mulberry32(SAMPLE_SEED);
  const picked = new Set<number>();
  while (picked.size < Math.min(SAMPLE_SIZE, pool.length))
    picked.add(Math.floor(rand() * pool.length));
  const sample = [...picked].map((i) => pool[i]!);

  mkdirSync(OUT, { recursive: true });
  const csv = (v: string | number | boolean): string => `"${String(v).replace(/"/g, '""')}"`;
  writeFileSync(
    join(OUT, 'summary.json'),
    JSON.stringify(
      {
        generatedFrom: 'Tatoeba per-language exports + tanos N5/N4 (Wayback 2020-07-28)',
        vocab: {
          N5: vocab.filter((v) => v.level === 'N5').length,
          N4: vocab.filter((v) => v.level === 'N4').length,
        },
        pipeline: {
          totalJpn,
          withEng,
          duplicateText: dupes,
          containsLatin: latin,
          analysed: rows.length,
        },
        byLevelLength: rows.reduce<Record<string, number>>((a, r) => {
          a[r.level] = (a[r.level] ?? 0) + 1;
          return a;
        }, {}),
        counts,
        topNearMissLemmas: [...nearMiss].sort((a, b) => b[1] - a[1]).slice(0, 60),
      },
      null,
      2,
    ),
  );
  const keys = [...LENGTH_LIMITS.map((l) => `le${l}`), 'nolimit'];
  writeFileSync(
    join(OUT, 'per-word.csv'),
    [
      ['level', 'kanji', 'kana', 'english', ...keys].join(','),
      ...vocab.map((v) =>
        [v.level, v.kanji, v.kana, v.english, ...keys.map((k) => perWord[v.id]?.[k] ?? 0)]
          .map(csv)
          .join(','),
      ),
    ].join('\n') + '\n',
  );
  writeFileSync(
    join(OUT, 'sample.csv'),
    [
      [
        'n',
        'jpn_id',
        'level',
        'len',
        'japanese',
        'english',
        'jpn_owner',
        'owner_native',
        'eng_id',
        'eng_owner',
      ].join(','),
      ...sample.map((r, i) =>
        [
          i + 1,
          r.id,
          r.level,
          r.len,
          r.text,
          r.engText,
          r.owner,
          r.ownerNative,
          r.engId,
          r.engOwner,
        ]
          .map(csv)
          .join(','),
      ),
    ].join('\n') + '\n',
  );
  console.log(JSON.stringify(counts, null, 1));
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

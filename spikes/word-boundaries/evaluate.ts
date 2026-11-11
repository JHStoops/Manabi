// Spike #4: score raw kuromoji, kuromoji + rules, and TinySegmenter against gold.tsv.
// Usage: node evaluate.ts   (needs raw.json from tokenize.ts)
import { readFileSync, writeFileSync } from 'node:fs';
import { toTiles } from './rules.ts';
import type { RawToken } from './rules.ts';

const read = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
const raw: {
  kuromoji: { id: number; text: string; tokens: RawToken[] }[];
  tinySegmenter: { id: number; tokens: string[] }[];
} = JSON.parse(read('raw.json'));

const gold = new Map<number, string[]>();
for (const line of read('gold.tsv').trim().split('\n')) {
  const [id, tiles] = line.split('\t');
  gold.set(Number(id), tiles.split(' '));
}

const PUNCT = /^[。、？！?!]+$/u;
const strip = (tokens: string[]) => tokens.filter((t) => !PUNCT.test(t));

// Internal boundary offsets (character positions between tiles).
const boundaries = (tiles: string[]) => {
  const out = new Set<number>();
  let pos = 0;
  tiles.slice(0, -1).forEach((t) => out.add((pos += [...t].length)));
  return out;
};

type Score = { exact: number; tp: number; fp: number; fn: number; failures: string[] };
const score = (name: string, predict: (id: number) => string[]): Score => {
  const s: Score = { exact: 0, tp: 0, fp: 0, fn: 0, failures: [] };
  for (const k of raw.kuromoji) {
    const g = gold.get(k.id)!;
    const p = strip(predict(k.id));
    if (p.join('') !== g.join(''))
      throw new Error(`${name} ${k.id}: text mismatch ${p.join('')} vs ${g.join('')}`);
    const gb = boundaries(g);
    const pb = boundaries(p);
    for (const b of pb) {
      if (gb.has(b)) s.tp++;
      else s.fp++;
    }
    for (const b of gb) if (!pb.has(b)) s.fn++;
    if (p.join(' ') === g.join(' ')) s.exact++;
    else s.failures.push(`${k.id}\t${k.text}\n  got:  ${p.join(' | ')}\n  want: ${g.join(' | ')}`);
  }
  return s;
};

const byId = <T extends { id: number }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
const kuro = byId(raw.kuromoji);
const tiny = byId(raw.tinySegmenter);

const results = {
  'kuromoji raw': score('kuromoji raw', (id) => kuro.get(id)!.tokens.map((t) => t.surface)),
  'kuromoji + rules': score('kuromoji + rules', (id) => toTiles(kuro.get(id)!.tokens)),
  'TinySegmenter raw': score('TinySegmenter raw', (id) => tiny.get(id)!.tokens),
};

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`;
let report =
  '| Method | Sentences exactly right | Boundary precision | Boundary recall | Boundary F1 |\n| --- | --- | --- | --- | --- |\n';
for (const [name, s] of Object.entries(results)) {
  const prec = s.tp / (s.tp + s.fp);
  const rec = s.tp / (s.tp + s.fn);
  report += `| ${name} | ${s.exact} / ${raw.kuromoji.length} | ${pct(s.tp, s.tp + s.fp)} | ${pct(s.tp, s.tp + s.fn)} | ${pct(2 * prec * rec, prec + rec)} |\n`;
}
console.log(report);
console.log('Remaining failures after rules:\n' + results['kuromoji + rules'].failures.join('\n'));
writeFileSync(
  new URL('./results.txt', import.meta.url),
  report +
    '\nRemaining failures after rules:\n' +
    results['kuromoji + rules'].failures.join('\n') +
    '\n',
);

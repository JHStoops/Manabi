// Spike #4: run kuromoji and TinySegmenter over sample.json, write raw.json and print timings.
// Usage: node tokenize.ts [sample.json|holdout.json]  (writes raw.json or raw-holdout.json)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const input = process.argv[2] ?? 'sample.json';
const output = input === 'sample.json' ? 'raw.json' : `raw-${input}`;

type KuromojiToken = {
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  conjugated_type: string;
  conjugated_form: string;
  basic_form: string;
  reading?: string;
};
type Tokenizer = { tokenize(text: string): KuromojiToken[] };

const sample: { id: number; text: string }[] = JSON.parse(
  readFileSync(new URL(`./${input}`, import.meta.url), 'utf8'),
);

const heapBefore = process.memoryUsage().heapUsed;
const t0 = performance.now();
const kuromoji = require('kuromoji');
const dicPath = new URL('./node_modules/kuromoji/dict/', import.meta.url).pathname;
const tokenizer: Tokenizer = await new Promise((resolve, reject) =>
  kuromoji
    .builder({ dicPath })
    .build((err: Error | null, t: Tokenizer) => (err ? reject(err) : resolve(t))),
);
const loadMs = performance.now() - t0;
const heapAfter = process.memoryUsage().heapUsed;

const t1 = performance.now();
const kuro = sample.map((s) => ({
  id: s.id,
  text: s.text,
  tokens: tokenizer.tokenize(s.text).map((t) => ({
    surface: t.surface_form,
    pos: t.pos,
    pos1: t.pos_detail_1,
    pos2: t.pos_detail_2,
    ctype: t.conjugated_type,
    cform: t.conjugated_form,
    base: t.basic_form,
    reading: t.reading,
  })),
}));
const tokenizeMs = performance.now() - t1;

const TinySegmenter = require('tiny-segmenter');
const t2 = performance.now();
const tiny = new TinySegmenter();
const tinyOut = sample.map((s) => ({ id: s.id, tokens: tiny.segment(s.text) as string[] }));
const tinyMs = performance.now() - t2;

writeFileSync(
  new URL(`./${output}`, import.meta.url),
  JSON.stringify({ kuromoji: kuro, tinySegmenter: tinyOut }, null, 1) + '\n',
);
console.log(
  JSON.stringify(
    {
      kuromojiLoadMs: Math.round(loadMs),
      kuromojiHeapMB: Math.round((heapAfter - heapBefore) / 1e6),
      rssMB: Math.round(process.memoryUsage().rss / 1e6),
      kuromojiTokenize100Ms: Math.round(tokenizeMs),
      tinySegmenterLoadAndRun100Ms: Math.round(tinyMs),
    },
    null,
    1,
  ),
);

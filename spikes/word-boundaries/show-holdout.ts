// Spike #4: print kuromoji + rules tiles for the held-out set, for hand-checking.
// Usage: node show-holdout.ts   (needs raw-holdout.json from `node tokenize.ts holdout.json`)
import { readFileSync } from 'node:fs';
import { toTiles } from './rules.ts';
import type { RawToken } from './rules.ts';

const raw: { kuromoji: { id: number; text: string; tokens: RawToken[] }[] } = JSON.parse(
  readFileSync(new URL('./raw-holdout.json', import.meta.url), 'utf8'),
);
for (const s of raw.kuromoji) console.log(`${s.id}\t${s.text}\t${toTiles(s.tokens).join(' | ')}`);

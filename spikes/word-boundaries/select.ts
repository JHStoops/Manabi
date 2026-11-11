// Spike #4: pick ~100 rough-N5 Tatoeba sentences with a fixed seed.
// Usage: node select.ts <path to jpn_sentences.tsv>  (writes sample.json)
// Throwaway code: not part of any workspace.
import { readFileSync, writeFileSync } from 'node:fs';

const SEED = 20261111;
const COUNT = 100;
const MIN_LEN = 5;
const MAX_LEN = 16;

// Roughly the JLPT N5 kanji set (about 80 characters).
const N5_KANJI =
  '一二三四五六七八九十百千万円時日月火水木金土曜本人今年上下中大小山川田口目耳手足力男女子学生先何前後午半分見行来出入食飲言話読書聞買休立会社校長高安新古多少白雨天気電車駅道店外国語名友毎週間東西南北右左父母私';

const allowed = (ch: string): boolean =>
  /[ぁ-ゖァ-ヺー。、？！]/u.test(ch) || N5_KANJI.includes(ch);

// mulberry32: small deterministic PRNG so the sample is reproducible.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const path = process.argv[2];
if (!path) throw new Error('usage: node select.ts <jpn_sentences.tsv>');

const seen = new Set<string>();
const candidates: { id: number; text: string }[] = [];
for (const line of readFileSync(path, 'utf8').split('\n')) {
  const [id, lang, text] = line.split('\t');
  if (lang !== 'jpn' || !text) continue;
  const chars = [...text];
  if (chars.length < MIN_LEN || chars.length > MAX_LEN) continue;
  if (!chars.every(allowed)) continue;
  // Need at least one kanji and some kana so it reads like an N5 sentence.
  if (!chars.some((c) => N5_KANJI.includes(c))) continue;
  if (seen.has(text)) continue;
  seen.add(text);
  candidates.push({ id: Number(id), text });
}
candidates.sort((a, b) => a.id - b.id);

const rand = mulberry32(SEED);
for (let i = candidates.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
}
const sample = candidates.slice(0, COUNT).sort((a, b) => a.id - b.id);
writeFileSync(new URL('./sample.json', import.meta.url), JSON.stringify(sample, null, 1) + '\n');
// Held-out set: the next 40 from the same shuffle, never used while writing the rules.
const holdout = candidates.slice(COUNT, COUNT + 40).sort((a, b) => a.id - b.id);
writeFileSync(new URL('./holdout.json', import.meta.url), JSON.stringify(holdout, null, 1) + '\n');
console.log(`candidates: ${candidates.length}, picked: ${sample.length}`);

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { tileSchema } from '@manabi/core';
import type { LanguagePlugin } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import { loadAnalyzer, segmentText } from './segmentation';

// FR-238: kuromoji plus lang-ja's rules against the word-boundary spike's hand-tiled sentences.
// Each fixture line: Tatoeba id, sentence, wanted tiles separated by spaces.
const fixture = (name: string) =>
  readFileSync(path.join(__dirname, '../fixtures/word-boundaries', name), 'utf8')
    .trim()
    .split('\n')
    .map((line) => {
      const [id, text, tiles] = line.split('\t') as [string, string, string];
      return { id, text, want: tiles.split(' ') };
    });

// Internal split points, in characters.
const boundaries = (tiles: string[]): Set<number> => {
  const out = new Set<number>();
  let at = 0;
  tiles.slice(0, -1).forEach((t) => out.add((at += [...t].length)));
  return out;
};

async function score(name: string) {
  const sentences = fixture(name);
  let exact = 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const { text, want } of sentences) {
    const got = (await segmentText(japanese, text)).map((t) => t.surface);
    expect(got.join('')).toBe(want.join(''));
    if (got.join(' ') === want.join(' ')) exact++;
    const wb = boundaries(want);
    const gb = boundaries(got);
    for (const b of gb)
      if (wb.has(b)) tp++;
      else fp++;
    for (const b of wb) if (!gb.has(b)) fn++;
  }
  const precision = tp / (tp + fp);
  const recall = tp / (tp + fn);
  return { exact, total: sentences.length, f1: (2 * precision * recall) / (precision + recall) };
}

// The dictionary takes a few hundred ms to load; load it once for the whole file.
beforeAll(() => loadAnalyzer('kuromoji-ipadic'));

describe('segmentText with kuromoji-ipadic and lang-ja', () => {
  it('tiles at least 95 of the 100 gold sentences exactly, with boundary F1 of at least 99%', async () => {
    const { exact, total, f1 } = await score('gold.tsv');
    expect(total).toBe(100);
    expect(exact).toBeGreaterThanOrEqual(95);
    expect(f1).toBeGreaterThanOrEqual(0.99);
  });

  it('tiles at least 37 of the 40 held-out sentences exactly', async () => {
    // The spike scored 35; R10 and the idiom split list fix 172936 and 183263.
    const { exact, total } = await score('holdout.tsv');
    expect(total).toBe(40);
    expect(exact).toBeGreaterThanOrEqual(37);
  });

  it('gives every tile a base form and a reading', async () => {
    expect(await segmentText(japanese, '食べました。')).toEqual([
      { surface: '食べました', base: '食べる', reading: 'たべました', counted: true },
    ]);
    for (const { text } of fixture('gold.tsv')) {
      for (const { surface, base, reading } of await segmentText(japanese, text)) {
        expect(tileSchema.safeParse({ surface, base, reading }).success).toBe(true);
      }
    }
  });

  it('gives a sentence the kana reading sent to TTS (FR-136)', async () => {
    const tiles = await segmentText(japanese, 'ルーシーはもう電話しましたか。');
    expect(japanese.readingOf(tiles)).toBe('るーしーはもうでんわしましたか');
  });
});

describe('segmentText adapters', () => {
  it('splits on spaces for a plugin with no analyzer', async () => {
    const plugin = {
      ...japanese,
      analyzer: null,
      segment: (tokens) =>
        tokens.map((t) => ({ surface: t.surface, base: t.surface, reading: '', counted: true })),
    } satisfies LanguagePlugin;
    expect((await segmentText(plugin, ' see  you\tsoon ')).map((t) => t.surface)).toEqual([
      'see',
      'you',
      'soon',
    ]);
  });

  it('rejects an unknown analyzer id', async () => {
    await expect(segmentText({ ...japanese, analyzer: 'nope' }, 'x')).rejects.toThrow(
      'No analyzer adapter is registered for "nope"',
    );
  });
});

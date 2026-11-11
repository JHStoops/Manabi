// Builds data/kanjivg-strokes.json from KanjiVG SVG files downloaded from the official
// KanjiVG repository (https://github.com/KanjiVG/kanjivg, folder kanji/).
// Usage: node scripts/build-data.ts <dir-with-svgs> <kanjivg-commit-sha>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseKanjiVgStrokes, KANJIVG_SIZE } from '../src/kanjivg.ts';
import { CHARACTERS } from '../src/characters.ts';

const [dir, commit] = process.argv.slice(2);
if (!dir || !commit) {
  console.error('usage: node scripts/build-data.ts <svg-dir> <kanjivg-commit-sha>');
  process.exit(1);
}

const characters = CHARACTERS.map(({ char, kind }) => {
  const codepoint = char.codePointAt(0)!.toString(16).padStart(5, '0');
  const strokes = parseKanjiVgStrokes(readFileSync(join(dir, `${codepoint}.svg`), 'utf8'));
  return { char, codepoint, kind, strokes };
});

const data = {
  source: 'KanjiVG',
  url: 'https://kanjivg.tagaini.net',
  repository: 'https://github.com/KanjiVG/kanjivg',
  commit,
  licence: 'CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/)',
  attribution:
    'Stroke data from KanjiVG, Copyright (C) 2009/2010/2011 Ulrich Apel, licensed under CC BY-SA 3.0. Only the stroke path d attributes were extracted; they are unchanged.',
  coordinateSize: KANJIVG_SIZE,
  characters,
};
writeFileSync(
  new URL('../data/kanjivg-strokes.json', import.meta.url),
  JSON.stringify(data, null, 2) + '\n',
);
console.log(`wrote ${characters.length} characters`);

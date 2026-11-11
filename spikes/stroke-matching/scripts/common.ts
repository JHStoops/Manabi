// Shared helpers for the spike's Node scripts.
import { readdirSync, readFileSync } from 'node:fs';
import type { Point } from '../src/geometry.ts';
import { flattenPath } from '../src/svgPath.ts';
import type { FixtureFile } from '../src/synth.ts';

export interface StrokeDataFile {
  coordinateSize: number;
  attribution: string;
  characters: Array<{ char: string; codepoint: string; kind: string; strokes: string[] }>;
}

export const root = new URL('../', import.meta.url);

export function loadStrokeData(): StrokeDataFile {
  return JSON.parse(readFileSync(new URL('data/kanjivg-strokes.json', root), 'utf8'));
}

export function strokePoints(data: StrokeDataFile): Map<string, Point[][]> {
  return new Map(data.characters.map((c) => [c.char, c.strokes.map((d) => flattenPath(d))]));
}

export function loadFixtures(): FixtureFile[] {
  const dir = new URL('fixtures/', root);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as FixtureFile);
}

// Runs Hanzi Writer's own stroke matcher in Node for comparison. Hanzi Writer does not export
// strokeMatches, so this evaluates its CommonJS build with the export line widened.
// Hanzi Writer is MIT licensed (Copyright (c) 2014 David Chanin).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Point } from '../src/geometry.ts';
import type { HanziWriterCharData } from '../src/hanziWriterData.ts';

interface HwStroke {
  points: Point[];
}
interface HwCharacter {
  strokes: HwStroke[];
}
interface HwInternals {
  strokeMatches: (
    userStroke: { points: Point[] },
    character: HwCharacter,
    strokeNum: number,
    options: { leniency?: number; isOutlineVisible?: boolean; averageDistanceThreshold?: number },
  ) => { isMatch: boolean; meta: { isStrokeBackwards: boolean } };
  parseCharData: (symbol: string, data: HanziWriterCharData) => HwCharacter;
}

export function loadHanziWriterInternals(): HwInternals {
  const require = createRequire(import.meta.url);
  const file = require.resolve('hanzi-writer/dist/index.cjs.js');
  const src = readFileSync(file, 'utf8').replace(
    'module.exports = HanziWriter;',
    'module.exports = { strokeMatches, parseCharData };',
  );
  if (!src.includes('module.exports = { strokeMatches')) {
    throw new Error('hanzi-writer build changed; update the harness');
  }
  const mod = { exports: {} as unknown };
  new Function('module', 'exports', 'require', 'global', src)(
    mod,
    mod.exports,
    require,
    globalThis,
  );
  return mod.exports as HwInternals;
}

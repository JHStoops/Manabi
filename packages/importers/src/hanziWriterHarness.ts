import { readFileSync } from 'node:fs';
import type { HanziWriterCharData, Point } from './hanziWriterData';

// Test helper, not exported from the package: Hanzi Writer's own matcher, run in Node.

export interface HanziWriterInternals {
  parseCharData: (symbol: string, data: HanziWriterCharData) => unknown;
  strokeMatches: (
    userStroke: { points: Point[] },
    character: unknown,
    strokeNum: number,
    options: { leniency: number; isOutlineVisible: boolean },
  ) => { isMatch: boolean };
}

/**
 * Hanzi Writer (MIT) in Node: it does not export its matcher, so its CommonJS build is evaluated
 * with the export line widened (the #2 spike's harness).
 */
export function loadHanziWriter(): HanziWriterInternals {
  const src = readFileSync(require.resolve('hanzi-writer/dist/index.cjs.js'), 'utf8').replace(
    'module.exports = HanziWriter;',
    'module.exports = { strokeMatches, parseCharData };',
  );
  if (!src.includes('module.exports = { strokeMatches')) throw new Error('hanzi-writer changed');
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', 'global', src)(
    mod,
    mod.exports,
    require,
    globalThis,
  );
  return mod.exports as HanziWriterInternals;
}

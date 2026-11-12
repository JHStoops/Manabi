// Converts KanjiVG centrelines into Hanzi Writer character data, so Hanzi Writer can quiz
// Japanese characters without its own Make Me a Hanzi (Arphic-licensed) data.
//
// Hanzi Writer expects { strokes: outline path strings, medians: [x, y][] per stroke } in a
// 1024 x 1024 space with y pointing up, where y runs from -124 (bottom) to 900 (top).
// KanjiVG has no outlines, so each outline is a fixed-width ribbon around the centreline.
import type { Point } from './geometry.ts';
import { pathLength, resample } from './geometry.ts';

export interface HanziWriterCharData {
  strokes: string[];
  medians: Array<Array<[number, number]>>;
  radStrokes: number[];
}

export function toHanziWriterSpace(p: Point, size: number): Point {
  return { x: (p.x * 1024) / size, y: 900 - (p.y * 1024) / size };
}

function round(n: number): number {
  return Math.round(n);
}

/** A closed ribbon of the given half-width (in output units) around a polyline. */
export function ribbonOutline(points: readonly Point[], halfWidth: number): string {
  const n = points.length;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(n - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * halfWidth;
    const ny = (dx / len) * halfWidth;
    const p = points[i]!;
    left.push({ x: p.x + nx, y: p.y + ny });
    right.push({ x: p.x - nx, y: p.y - ny });
  }
  const ring = [...left, ...right.reverse()];
  return ring.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ') + ' Z';
}

/** Builds Hanzi Writer data from stroke centrelines given in a square space of side `size`. */
export function toHanziWriterData(
  strokes: ReadonlyArray<readonly Point[]>,
  size: number,
): HanziWriterCharData {
  const out: HanziWriterCharData = { strokes: [], medians: [], radStrokes: [] };
  for (const stroke of strokes) {
    const mapped = stroke.map((p) => toHanziWriterSpace(p, size));
    const dense = resample(mapped, 48);
    out.strokes.push(ribbonOutline(dense, 28));
    // Make Me a Hanzi medians are sparse; about one point per 60 units keeps the same density.
    const count = Math.max(4, Math.min(16, Math.round(pathLength(mapped) / 60)));
    out.medians.push(resample(mapped, count).map((p) => [round(p.x), round(p.y)]));
  }
  return out;
}

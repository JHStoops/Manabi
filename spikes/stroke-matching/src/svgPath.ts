// Minimal SVG path parser that flattens a path's `d` attribute into a polyline.
// KanjiVG stroke paths only use M, C, c, S and s, but L, H, V, Q and Z are handled too.
import type { Point } from './geometry.ts';

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const COMMAND = /([MmLlHhVvCcSsQqZz])([^MmLlHhVvCcSsQqZz]*)/g;

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, steps: number, out: Point[]): void {
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
}

/** Flattens an SVG path into points. Each curve segment becomes `curveSteps` line segments. */
export function flattenPath(d: string, curveSteps = 12): Point[] {
  const out: Point[] = [];
  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  let lastCtrl: Point | null = null; // reflected control point for S/s
  for (const m of d.matchAll(COMMAND)) {
    const cmd = m[1]!;
    const nums = (m[2]!.match(NUMBER) ?? []).map(Number);
    const rel = cmd === cmd.toLowerCase();
    const at = (dx: number, dy: number): Point =>
      rel ? { x: cur.x + dx, y: cur.y + dy } : { x: dx, y: dy };
    const upper = cmd.toUpperCase();
    if (upper === 'Z') {
      out.push({ ...start });
      cur = start;
      lastCtrl = null;
      continue;
    }
    const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4 }[upper] ?? 2;
    for (let i = 0; i + arity <= nums.length; i += arity) {
      const a = nums.slice(i, i + arity) as number[];
      if (upper === 'M') {
        cur = at(a[0]!, a[1]!);
        if (i === 0) start = cur;
        out.push(cur);
        lastCtrl = null;
      } else if (upper === 'L') {
        cur = at(a[0]!, a[1]!);
        out.push(cur);
        lastCtrl = null;
      } else if (upper === 'H') {
        cur = { x: rel ? cur.x + a[0]! : a[0]!, y: cur.y };
        out.push(cur);
        lastCtrl = null;
      } else if (upper === 'V') {
        cur = { x: cur.x, y: rel ? cur.y + a[0]! : a[0]! };
        out.push(cur);
        lastCtrl = null;
      } else if (upper === 'C') {
        const c1 = at(a[0]!, a[1]!);
        const c2 = at(a[2]!, a[3]!);
        const end = at(a[4]!, a[5]!);
        cubic(cur, c1, c2, end, curveSteps, out);
        lastCtrl = c2;
        cur = end;
      } else if (upper === 'S') {
        const c1: Point = lastCtrl ? { x: 2 * cur.x - lastCtrl.x, y: 2 * cur.y - lastCtrl.y } : cur;
        const c2 = at(a[0]!, a[1]!);
        const end = at(a[2]!, a[3]!);
        cubic(cur, c1, c2, end, curveSteps, out);
        lastCtrl = c2;
        cur = end;
      } else if (upper === 'Q') {
        const q = at(a[0]!, a[1]!);
        const end = at(a[2]!, a[3]!);
        // Raise the quadratic to a cubic.
        const c1 = { x: cur.x + (2 / 3) * (q.x - cur.x), y: cur.y + (2 / 3) * (q.y - cur.y) };
        const c2 = { x: end.x + (2 / 3) * (q.x - end.x), y: end.y + (2 / 3) * (q.y - end.y) };
        cubic(cur, c1, c2, end, curveSteps, out);
        lastCtrl = null;
        cur = end;
      }
    }
  }
  return out;
}

// Plain 2D geometry helpers for the stroke matcher spike (issue #2).
// Pure TypeScript: no Node or browser APIs, so it can move to packages/lang-ja or core later.

export interface Point {
  x: number;
  y: number;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1]!, points[i]!);
  }
  return total;
}

/** Drops consecutive points that are identical (pointer events often repeat a position). */
export function dedupe(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push({ x: p.x, y: p.y });
  }
  return out;
}

/**
 * Resamples a polyline to exactly `n` points spaced evenly along its arc length.
 * A zero-length input (a tap) yields `n` copies of its first point.
 */
export function resample(points: readonly Point[], n: number): Point[] {
  if (n < 2) throw new Error('resample needs n >= 2');
  const pts = dedupe(points);
  const first = pts[0];
  if (!first) return [];
  const total = pathLength(pts);
  if (pts.length === 1 || total === 0) {
    return Array.from({ length: n }, () => ({ x: first.x, y: first.y }));
  }
  const step = total / (n - 1);
  const out: Point[] = [{ x: first.x, y: first.y }];
  let prev = first;
  let i = 1;
  let carried = 0; // distance travelled since the last emitted point
  while (out.length < n - 1 && i < pts.length) {
    const next = pts[i]!;
    const seg = distance(prev, next);
    if (carried + seg >= step && seg > 0) {
      const t = (step - carried) / seg;
      const q = { x: prev.x + t * (next.x - prev.x), y: prev.y + t * (next.y - prev.y) };
      out.push(q);
      prev = q;
      carried = 0;
    } else {
      carried += seg;
      prev = next;
      i++;
    }
  }
  const last = pts[pts.length - 1]!;
  while (out.length < n) out.push({ x: last.x, y: last.y });
  return out;
}

/** Angle between two vectors in degrees, 0 to 180. Returns 0 when either vector is zero. */
export function angleBetween(a: Point, b: Point): number {
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  if (la === 0 || lb === 0) return 0;
  const cos = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function centroid(points: readonly Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  const n = points.length || 1;
  return { x: x / n, y: y / n };
}

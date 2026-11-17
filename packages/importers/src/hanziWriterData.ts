// FR-077: converts stroke centrelines into Hanzi Writer character data (from the #2 spike), so the
// stroke canvas never needs Hanzi Writer's bundled Make Me a Hanzi data.
//
// Hanzi Writer expects { strokes: outline path strings, medians: [x, y][] per stroke } in a
// 1024 x 1024 space with y pointing up, where y runs from -124 (bottom) to 900 (top). The source
// has no outlines, so each outline is a fixed-width ribbon around the centreline.

export interface Point {
  x: number;
  y: number;
}

/** Hanzi Writer's character data format, as stored in `stroke_data.strokes`. */
export interface HanziWriterCharData {
  strokes: string[];
  medians: Array<Array<[number, number]>>;
}

function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return total;
}

/**
 * Resamples a polyline to exactly `n` (at least 2) points spaced evenly along its arc length.
 * A zero-length input yields `n` copies of its first point.
 */
function resample(points: readonly Point[], n: number): Point[] {
  const pts = points.filter(
    (p, i) => i === 0 || p.x !== points[i - 1]!.x || p.y !== points[i - 1]!.y,
  );
  const first = pts[0];
  if (!first) return [];
  const total = pathLength(pts);
  if (total === 0) return Array.from({ length: n }, () => ({ ...first }));
  const step = total / (n - 1);
  const out: Point[] = [{ ...first }];
  let prev = first;
  let i = 1;
  let carried = 0; // distance travelled since the last emitted point
  while (out.length < n - 1 && i < pts.length) {
    const next = pts[i]!;
    const seg = Math.hypot(next.x - prev.x, next.y - prev.y);
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
  while (out.length < n) out.push({ ...last });
  return out;
}

/** Maps a point from a square y-down space of side `size` to Hanzi Writer's space. */
export function toHanziWriterSpace(p: Point, size: number): Point {
  return { x: (p.x * 1024) / size, y: 900 - (p.y * 1024) / size };
}

/** A closed ribbon of the given half-width (in output units) around a polyline. */
function ribbonOutline(points: readonly Point[], halfWidth: number): string {
  const n = points.length;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)]!;
    const b = points[Math.min(n - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (-(b.y - a.y) / len) * halfWidth;
    const ny = ((b.x - a.x) / len) * halfWidth;
    const p = points[i]!;
    left.push({ x: p.x + nx, y: p.y + ny });
    right.push({ x: p.x - nx, y: p.y - ny });
  }
  const ring = [...left, ...right.reverse()];
  return (
    ring.map((p, i) => `${i === 0 ? 'M' : 'L'} ${Math.round(p.x)} ${Math.round(p.y)}`).join(' ') +
    ' Z'
  );
}

/** Builds Hanzi Writer data from stroke centrelines given in a square y-down space of side `size`. */
export function toHanziWriterData(
  strokes: ReadonlyArray<readonly Point[]>,
  size: number,
): HanziWriterCharData {
  const out: HanziWriterCharData = { strokes: [], medians: [] };
  for (const stroke of strokes) {
    const mapped = stroke.map((p) => toHanziWriterSpace(p, size));
    out.strokes.push(ribbonOutline(resample(mapped, 48), 28));
    // Make Me a Hanzi medians are sparse; about one point per 60 units keeps the same density.
    const count = Math.max(4, Math.min(16, Math.round(pathLength(mapped) / 60)));
    out.medians.push(resample(mapped, count).map((p) => [Math.round(p.x), Math.round(p.y)]));
  }
  return out;
}

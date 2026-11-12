// Synthetic stroke attempts for tuning the matcher (issue #2). They approximate a learner's
// finger on a phone: offset, wobble, scale and rotation for good attempts; reversed, wrong-order,
// wrong-shape and misplaced strokes for bad ones. Deterministic for a given seed.
// They are a stand-in until real mouse, finger and stylus recordings exist.
import type { Point } from './geometry.ts';
import { centroid, distance, pathLength, resample } from './geometry.ts';

/**
 * good: should be accepted. sloppy: recognisable but messy; a forgiving matcher should accept.
 * bad: should be rejected. borderline: gently curved strokes drawn straight or bowed the other
 * way; either verdict is defensible, so they are reported but not counted as errors.
 */
export type AttemptGroup = 'good' | 'sloppy' | 'bad' | 'borderline';

/** One drawn stroke, in the same format as the test page's JSON export. */
export interface Attempt {
  id: string;
  strokeIndex: number;
  expect: 'accept' | 'reject' | 'either';
  group: AttemptGroup;
  variant: string;
  pointerType: string;
  /** [x, y, t] with x and y in canvas units (canvasSize of the fixture) and t in ms. */
  points: Array<[number, number, number]>;
}

export interface FixtureFile {
  char: string;
  codepoint: string;
  canvasSize: number;
  source: 'synthetic' | 'recorded';
  note: string;
  attempts: Attempt[];
}

export type Rng = () => number;

/** mulberry32: a small seeded PRNG. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function between(rng: Rng, lo: number, hi: number): number {
  return lo + (hi - lo) * rng();
}

function transform(
  points: readonly Point[],
  about: Point,
  scale: number,
  rotationDeg: number,
  offset: Point,
): Point[] {
  const r = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return points.map((p) => {
    const x = (p.x - about.x) * scale;
    const y = (p.y - about.y) * scale;
    return {
      x: about.x + x * cos - y * sin + offset.x,
      y: about.y + x * sin + y * cos + offset.y,
    };
  });
}

/** Max distance of any point from the straight line between the stroke's ends. */
export function chordDeviation(points: readonly Point[]): number {
  const a = points[0]!;
  const b = points[points.length - 1]!;
  const len = distance(a, b);
  let max = 0;
  for (const p of points) {
    const d =
      len === 0
        ? distance(p, a)
        : Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
    max = Math.max(max, d);
  }
  return max;
}

function mirrorAcrossChord(points: readonly Point[]): Point[] {
  const a = points[0]!;
  const b = points[points.length - 1]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  return points.map((p) => {
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    const fx = a.x + t * dx;
    const fy = a.y + t * dy;
    return { x: 2 * fx - p.x, y: 2 * fy - p.y };
  });
}

interface Wobble {
  /** Perpendicular wobble amplitude, fraction of canvas size. */
  wobble: number;
  /** Per-sample noise sigma, fraction of canvas size. */
  noise: number;
  /** Fraction of stroke length trimmed (negative) or overshot (positive) at the end. */
  endChange: number;
}

/** Adds hand wobble and pointer noise, then samples like ~60 Hz pointer events. */
function handDrawn(path: readonly Point[], size: number, rng: Rng, w: Wobble): Point[] {
  let dense = resample(path, 120);
  if (w.endChange !== 0) {
    const last = dense[dense.length - 1]!;
    const prev = dense[dense.length - 6]!;
    if (w.endChange > 0) {
      const len = pathLength(dense) * w.endChange;
      const d = distance(prev, last) || 1;
      dense = [
        ...dense,
        { x: last.x + ((last.x - prev.x) / d) * len, y: last.y + ((last.y - prev.y) / d) * len },
      ];
    } else {
      dense = dense.slice(0, Math.max(2, Math.round(dense.length * (1 + w.endChange))));
    }
    dense = resample(dense, 120);
  }
  const phase1 = rng() * Math.PI * 2;
  const phase2 = rng() * Math.PI * 2;
  const freq = between(rng, 1, 2.5);
  const amp = w.wobble * size;
  const wobbled = dense.map((p, i) => {
    const a = dense[Math.max(0, i - 1)]!;
    const b = dense[Math.min(dense.length - 1, i + 1)]!;
    const len = distance(a, b) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const s = i / (dense.length - 1);
    const off =
      amp * (0.7 * Math.sin(2 * Math.PI * freq * s + phase1) + 0.3 * Math.sin(9 * s + phase2));
    return { x: p.x + nx * off, y: p.y + ny * off };
  });
  // Pointer samples: slow at the ends, fast in the middle (ease in and out).
  const lenUnits = (pathLength(wobbled) / size) * 100;
  const count = Math.max(6, Math.round((250 + lenUnits * 4) / 16.7));
  const out: Point[] = [];
  for (let k = 0; k < count; k++) {
    const s = (1 - Math.cos((Math.PI * k) / (count - 1))) / 2;
    const p = wobbled[Math.round(s * (wobbled.length - 1))]!;
    out.push({
      x: p.x + gaussian(rng) * w.noise * size,
      y: p.y + gaussian(rng) * w.noise * size,
    });
  }
  return out;
}

function toTuples(points: readonly Point[]): Array<[number, number, number]> {
  return points.map((p, i) => [
    Math.round(p.x * 10) / 10,
    Math.round(p.y * 10) / 10,
    Math.round(i * 16.7),
  ]);
}

function randomOffset(rng: Rng, max: number, size: number): Point {
  const a = rng() * Math.PI * 2;
  const r = max * size * Math.sqrt(rng());
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

/**
 * Generates good, sloppy and bad attempts for every stroke of one character.
 * `strokes` are centrelines in a square space of side `size`.
 */
export function generateAttempts(
  char: string,
  strokes: ReadonlyArray<readonly Point[]>,
  size: number,
  seed: number,
  repeats = 3,
): Attempt[] {
  const rng = makeRng(seed);
  const centre = { x: size / 2, y: size / 2 };
  const attempts: Attempt[] = [];
  const neat: Wobble = { wobble: 0.004, noise: 0.002, endChange: 0 };
  const finger = (): Wobble => ({
    wobble: between(rng, 0.008, 0.018),
    noise: 0.004,
    endChange: between(rng, -0.08, 0.08),
  });
  const add = (
    strokeIndex: number,
    group: AttemptGroup,
    variant: string,
    rep: number,
    points: Point[],
  ): void => {
    attempts.push({
      id: `${char}-s${strokeIndex + 1}-${variant}-${rep}`,
      strokeIndex,
      expect: group === 'bad' ? 'reject' : group === 'borderline' ? 'either' : 'accept',
      group,
      variant,
      pointerType: 'synthetic',
      points: toTuples(points),
    });
  };

  strokes.forEach((stroke, i) => {
    // Strongly curved strokes (corners, hooks, loops) drawn straight or bowed the wrong way are
    // wrong shapes; gently curved ones (sweeps) are borderline.
    const deviation = chordDeviation(stroke) / size;
    const shapeGroup: AttemptGroup | undefined =
      deviation > 0.15 ? 'bad' : deviation > 0.05 ? 'borderline' : undefined;
    for (let rep = 0; rep < repeats; rep++) {
      // Good: the whole character drawn a little off; each stroke wobbly like a finger.
      add(i, 'good', 'neat', rep, handDrawn(stroke, size, rng, neat));
      add(
        i,
        'good',
        'finger',
        rep,
        handDrawn(
          transform(stroke, centre, 1, 0, randomOffset(rng, 0.04, size)),
          size,
          rng,
          finger(),
        ),
      );
      add(
        i,
        'good',
        'scaled',
        rep,
        handDrawn(
          transform(stroke, centre, rep % 2 ? 1.15 : 0.85, 0, randomOffset(rng, 0.02, size)),
          size,
          rng,
          finger(),
        ),
      );
      add(
        i,
        'good',
        'shifted',
        rep,
        handDrawn(
          transform(stroke, centre, 1, 0, { x: 0.06 * size * (rep % 2 ? 1 : -1), y: 0.03 * size }),
          size,
          rng,
          finger(),
        ),
      );
      add(
        i,
        'good',
        'rotated',
        rep,
        handDrawn(
          transform(stroke, centre, 1, rep % 2 ? 7 : -7, { x: 0, y: 0 }),
          size,
          rng,
          finger(),
        ),
      );
      // Sloppy but recognisable: a forgiving matcher should still accept most of these.
      add(
        i,
        'sloppy',
        'sloppy',
        rep,
        handDrawn(
          transform(
            stroke,
            centre,
            between(rng, 0.78, 1.22),
            between(rng, -10, 10),
            randomOffset(rng, 0.08, size),
          ),
          size,
          rng,
          { wobble: between(rng, 0.02, 0.035), noise: 0.006, endChange: between(rng, -0.15, 0.15) },
        ),
      );

      // Bad attempts.
      add(i, 'bad', 'reversed', rep, handDrawn([...stroke].reverse(), size, rng, finger()));
      const other = i + 1 < strokes.length ? i + 1 : strokes.length > 2 ? i - 1 : -1;
      if (other > i) {
        // Skipping ahead to the next stroke. (Redrawing an earlier stroke is not a fixture:
        // the matcher only compares against the current and later strokes.)
        add(i, 'bad', 'wrong-order', rep, handDrawn(strokes[other]!, size, rng, finger()));
      }
      const c = centroid(stroke);
      add(
        i,
        'bad',
        'rotated-90',
        rep,
        handDrawn(transform(stroke, c, 1, rep % 2 ? 90 : -90, { x: 0, y: 0 }), size, rng, finger()),
      );
      const ang = rng() * Math.PI * 2;
      const away = { x: Math.cos(ang) * 0.3 * size, y: Math.sin(ang) * 0.3 * size };
      add(
        i,
        'bad',
        'misplaced',
        rep,
        handDrawn(transform(stroke, c, 1, 0, away), size, rng, finger()),
      );
      if (shapeGroup) {
        const a = stroke[0]!;
        const b = stroke[stroke.length - 1]!;
        add(i, shapeGroup, 'straightened', rep, handDrawn([a, b], size, rng, finger()));
        add(
          i,
          shapeGroup,
          'mirrored',
          rep,
          handDrawn(mirrorAcrossChord(stroke), size, rng, finger()),
        );
      }
    }
  });
  return attempts;
}

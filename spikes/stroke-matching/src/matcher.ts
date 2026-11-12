// Stroke matcher prototype from SDD section 9 (Stroke canvas) and section 14 (Stroke matching spike).
// FR-072: judge each drawn stroke on order, direction and position within a configurable tolerance.
//
// The drawn stroke and the expected stroke are both resampled to N points, then compared on
// start point, end point, overall direction and average point-to-point distance. Distances are
// fractions of the canvas size, so the same tolerances work for any canvas or coordinate space.
// Pure TypeScript: no Node or browser APIs.
import type { Point } from './geometry.ts';
import { angleBetween, centroid, distance, pathLength, resample } from './geometry.ts';

export interface Tolerances {
  /** Max distance between drawn and expected start points, and between end points, as a fraction of canvas size. */
  startEnd: number;
  /** Max mean distance between corresponding resampled points, as a fraction of canvas size. */
  avgDist: number;
  /** Max angle in degrees between drawn and expected overall direction. */
  directionDeg: number;
  /** Drawn strokes shorter than this fraction of the expected length are treated as taps. */
  minLengthRatio: number;
  /**
   * When true, the average distance is measured after moving the drawn stroke so its centroid
   * sits on the expected stroke's centroid. Position is then judged only by the start and end
   * checks, and the distance check judges shape. Spike variant; see the spike report.
   */
  alignCentroids?: boolean;
}

/** Recommended starting point; see docs/spikes/stroke-matching.md. */
export const DEFAULT_TOLERANCES: Tolerances = {
  startEnd: 0.2,
  avgDist: 0.13,
  directionDeg: 60,
  minLengthRatio: 0.3,
};

export const DEFAULT_RESAMPLE_POINTS = 32;

export interface StrokeComparison {
  accepted: boolean;
  /** Measured values, distances as fractions of canvas size. */
  startDist: number;
  endDist: number;
  avgDist: number;
  directionDeg: number;
  lengthRatio: number;
  /** Which individual checks failed. */
  failed: Array<'length' | 'start' | 'end' | 'direction' | 'distance'>;
}

/**
 * Overall direction of a stroke. Uses the chord (start to end) unless the stroke nearly closes
 * on itself (for example the loop of の), where the chord is unstable; then it uses the vector
 * from the start to the point a quarter of the way along.
 */
function overallDirection(resampled: readonly Point[]): Point {
  const first = resampled[0]!;
  const last = resampled[resampled.length - 1]!;
  const chord = { x: last.x - first.x, y: last.y - first.y };
  const len = pathLength(resampled);
  if (len > 0 && Math.hypot(chord.x, chord.y) < 0.3 * len) {
    const q = resampled[Math.round((resampled.length - 1) / 4)]!;
    return { x: q.x - first.x, y: q.y - first.y };
  }
  return chord;
}

/** Compares one drawn stroke with one expected stroke. `size` is the canvas side length. */
export function compareStroke(
  drawn: readonly Point[],
  expected: readonly Point[],
  size: number,
  tol: Tolerances = DEFAULT_TOLERANCES,
  n: number = DEFAULT_RESAMPLE_POINTS,
): StrokeComparison {
  const d = resample(drawn, n);
  const e = resample(expected, n);
  const expectedLen = pathLength(e);
  const lengthRatio = expectedLen > 0 ? pathLength(d) / expectedLen : 0;
  const startDist = d.length ? distance(d[0]!, e[0]!) / size : Infinity;
  const endDist = d.length ? distance(d[d.length - 1]!, e[e.length - 1]!) / size : Infinity;
  let shift = { x: 0, y: 0 };
  if (tol.alignCentroids && d.length) {
    const cd = centroid(d);
    const ce = centroid(e);
    shift = { x: ce.x - cd.x, y: ce.y - cd.y };
  }
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    sum += distance({ x: d[i]!.x + shift.x, y: d[i]!.y + shift.y }, e[i]!);
  }
  const avgDist = d.length ? sum / d.length / size : Infinity;
  const directionDeg = d.length ? angleBetween(overallDirection(d), overallDirection(e)) : 180;

  const failed: StrokeComparison['failed'] = [];
  if (lengthRatio < tol.minLengthRatio) failed.push('length');
  if (startDist > tol.startEnd) failed.push('start');
  if (endDist > tol.startEnd) failed.push('end');
  if (directionDeg > tol.directionDeg) failed.push('direction');
  if (avgDist > tol.avgDist) failed.push('distance');
  return {
    accepted: failed.length === 0,
    startDist,
    endDist,
    avgDist,
    directionDeg,
    lengthRatio,
    failed,
  };
}

export type StrokeVerdictReason =
  | 'ok'
  | 'reversed'
  | 'wrong-order'
  | 'too-short'
  | 'off-start'
  | 'off-end'
  | 'wrong-direction'
  | 'wrong-shape';

export interface StrokeVerdict {
  accepted: boolean;
  reason: StrokeVerdictReason;
  comparison: StrokeComparison;
  /** Index of the stroke the drawing matched instead, when reason is 'wrong-order'. */
  matchedStroke?: number;
}

/**
 * Judges a drawn stroke as an attempt at stroke `index` of a character (trace or memory mode).
 * Rejects strokes drawn backwards and strokes that match a later stroke (wrong order),
 * mirroring the Product Spec rule that such strokes are discarded.
 */
export function judgeStroke(
  drawn: readonly Point[],
  strokes: ReadonlyArray<readonly Point[]>,
  index: number,
  size: number,
  tol: Tolerances = DEFAULT_TOLERANCES,
  n: number = DEFAULT_RESAMPLE_POINTS,
): StrokeVerdict {
  const expected = strokes[index];
  if (!expected) throw new Error(`no stroke ${index}`);
  const comparison = compareStroke(drawn, expected, size, tol, n);

  // A later stroke that also matches, and fits much better, means the learner skipped ahead.
  let better: { index: number; avgDist: number } | undefined;
  for (let j = index + 1; j < strokes.length; j++) {
    const other = compareStroke(drawn, strokes[j]!, size, tol, n);
    if (other.accepted && (!better || other.avgDist < better.avgDist)) {
      better = { index: j, avgDist: other.avgDist };
    }
  }

  if (comparison.accepted) {
    if (better && better.avgDist < 0.5 * comparison.avgDist) {
      return { accepted: false, reason: 'wrong-order', comparison, matchedStroke: better.index };
    }
    return { accepted: true, reason: 'ok', comparison };
  }
  if (comparison.failed.includes('length')) {
    return { accepted: false, reason: 'too-short', comparison };
  }
  const reversed = compareStroke([...drawn].reverse(), expected, size, tol, n);
  if (reversed.accepted) return { accepted: false, reason: 'reversed', comparison };
  if (better) {
    return { accepted: false, reason: 'wrong-order', comparison, matchedStroke: better.index };
  }
  const reason: StrokeVerdictReason = comparison.failed.includes('start')
    ? 'off-start'
    : comparison.failed.includes('end')
      ? 'off-end'
      : comparison.failed.includes('direction')
        ? 'wrong-direction'
        : 'wrong-shape';
  return { accepted: false, reason, comparison };
}

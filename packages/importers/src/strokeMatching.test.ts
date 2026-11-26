import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STROKE_LENIENCY } from '@manabi/core';
import { toHanziWriterSpace } from './hanziWriterData';
import { loadHanziWriter } from './hanziWriterHarness';
import { kanjiVgToHanziWriter } from './kanjivg';

// FR-072 regression guard (SDD section 13): Hanzi Writer's matcher at the configured leniency, on
// our converted KanjiVG data, over the #2 spike's synthetic attempts and the owner's recorded
// ones, so leniency or data changes cause no regressions.

interface Attempt {
  char?: string;
  strokeIndex: number;
  group: 'good' | 'sloppy' | 'bad' | 'borderline';
  /** [x, y, t] in the file's canvasSize units, t in ms. */
  points: Array<[number, number, number]>;
}
interface AttemptFile {
  char?: string;
  canvasSize: number;
  attempts: Attempt[];
}

const SPIKE = join(__dirname, '../../../spikes/stroke-matching');
const read = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));

const kanjiVg = read(join(SPIKE, 'data/kanjivg-strokes.json')) as {
  characters: Array<{ char: string; strokes: string[] }>;
};
const synthetic = readdirSync(join(SPIKE, 'fixtures'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => read(join(SPIKE, 'fixtures', f)) as AttemptFile);
const recorded = read(
  join(__dirname, '../fixtures/stroke-attempts-2026-11-11.json'),
) as AttemptFile;

const hw = loadHanziWriter();
const characters = new Map(
  kanjiVg.characters.map((c) => [
    c.char,
    hw.parseCharData(c.char, kanjiVgToHanziWriter(c.strokes)),
  ]),
);

/** Accepted and total attempts per group. */
function judge(
  files: AttemptFile[],
): Record<Attempt['group'], { accepted: number; total: number }> {
  const tally = {
    good: { accepted: 0, total: 0 },
    sloppy: { accepted: 0, total: 0 },
    bad: { accepted: 0, total: 0 },
    borderline: { accepted: 0, total: 0 },
  };
  for (const file of files) {
    for (const attempt of file.attempts) {
      const char = attempt.char ?? file.char!;
      const points = attempt.points.map(([x, y]) =>
        toHanziWriterSpace({ x: (x * 109) / file.canvasSize, y: (y * 109) / file.canvasSize }, 109),
      );
      // isOutlineVisible: trace mode, where the outline is shown.
      const { isMatch } = hw.strokeMatches({ points }, characters.get(char), attempt.strokeIndex, {
        leniency: STROKE_LENIENCY,
        isOutlineVisible: true,
      });
      tally[attempt.group].total++;
      if (isMatch) tally[attempt.group].accepted++;
    }
  }
  return tally;
}

describe(`Hanzi Writer at leniency ${STROKE_LENIENCY}`, () => {
  it('accepts at least 99% of good and at most 1% of bad synthetic attempts', () => {
    const { good, bad } = judge(synthetic);
    expect(good.total).toBe(765);
    expect(bad.total).toBe(630);
    expect(good.accepted / good.total).toBeGreaterThanOrEqual(0.99);
    expect(bad.accepted / bad.total).toBeLessThanOrEqual(0.01);
  });

  // No leniency meets 99% and 1% on the owner's recordings (owner's call on #51): at 1 it
  // accepts 81 of 82 good and 7 of 22 bad (slanted or overshooting 一 and 三, a wavy 二, a
  // squiggled 二 stroke 2, 人 sweeps drawn straight or short). Pinned so nothing gets worse.
  it("does no worse than today on the owner's phone recordings", () => {
    const { good, bad } = judge([recorded]);
    expect([good.total, bad.total]).toEqual([82, 22]);
    expect(good.accepted).toBeGreaterThanOrEqual(81);
    expect(bad.accepted).toBeLessThanOrEqual(7);
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Point } from './geometry.ts';
import { pathLength, resample } from './geometry.ts';
import { toHanziWriterData, toHanziWriterSpace } from './hanziWriterData.ts';
import { KANJIVG_SIZE, parseKanjiVgStrokes } from './kanjivg.ts';
import { DEFAULT_TOLERANCES, compareStroke, judgeStroke } from './matcher.ts';
import { flattenPath } from './svgPath.ts';
import type { FixtureFile } from './synth.ts';
import { generateAttempts } from './synth.ts';

const spikeDir = join(__dirname, '..');
const data = JSON.parse(readFileSync(join(spikeDir, 'data/kanjivg-strokes.json'), 'utf8')) as {
  characters: Array<{ char: string; strokes: string[] }>;
};
const strokesOf = (char: string): Point[][] =>
  data.characters.find((c) => c.char === char)!.strokes.map((d) => flattenPath(d));

describe('geometry', () => {
  it('resamples to evenly spaced points along the path', () => {
    const line = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    const r = resample(line, 5);
    expect(r).toHaveLength(5);
    expect(r[2]).toEqual({ x: 10, y: 0 });
    expect(pathLength(r)).toBeCloseTo(20);
  });

  it('turns a tap into repeated points', () => {
    expect(resample([{ x: 3, y: 4 }], 4)).toEqual(Array(4).fill({ x: 3, y: 4 }));
  });
});

describe('svg path and KanjiVG parsing', () => {
  it('flattens relative and smooth cubic commands', () => {
    const pts = flattenPath('M10,10c0,0,10,0,10,0s10,0,10,0', 4);
    expect(pts[0]).toEqual({ x: 10, y: 10 });
    expect(pts[pts.length - 1]).toEqual({ x: 30, y: 10 });
  });

  it('extracts strokes in stroke order', () => {
    const svg = `<svg><g><path id="kvg:04e8c-s2" kvg:type="㇐" d="M2,2 L3,3"/>
      <path id="kvg:04e8c-s1" d="M1,1 L2,2"/></g></svg>`;
    expect(parseKanjiVgStrokes(svg)).toEqual(['M1,1 L2,2', 'M2,2 L3,3']);
  });

  it('has the right stroke counts in the extracted data', () => {
    expect(strokesOf('あ')).toHaveLength(3);
    expect(strokesOf('水')).toHaveLength(4);
    expect(strokesOf('の')).toHaveLength(1);
  });
});

describe('matcher', () => {
  const ni = strokesOf('二');

  it('accepts the reference stroke itself', () => {
    expect(judgeStroke(ni[0]!, ni, 0, KANJIVG_SIZE).reason).toBe('ok');
  });

  it('scales tolerances with canvas size', () => {
    const scaled = ni[0]!.map((p) => ({ x: p.x * 3 + 6, y: p.y * 3 }));
    const expected = ni[0]!.map((p) => ({ x: p.x * 3, y: p.y * 3 }));
    expect(compareStroke(scaled, expected, KANJIVG_SIZE * 3).startDist).toBeCloseTo(
      6 / (KANJIVG_SIZE * 3),
    );
  });

  it('reports a stroke drawn backwards', () => {
    expect(judgeStroke([...ni[0]!].reverse(), ni, 0, KANJIVG_SIZE).reason).toBe('reversed');
  });

  it('reports a later stroke drawn first', () => {
    const v = judgeStroke(ni[1]!, ni, 0, KANJIVG_SIZE);
    expect(v.reason).toBe('wrong-order');
    expect(v.matchedStroke).toBe(1);
  });

  it('treats a tap as too short', () => {
    expect(judgeStroke([ni[0]![0]!], ni, 0, KANJIVG_SIZE).reason).toBe('too-short');
  });

  it('rejects a straight line in place of the loop of の', () => {
    const no = strokesOf('の');
    const line = [no[0]![0]!, no[0]![no[0]!.length - 1]!];
    expect(judgeStroke(line, no, 0, KANJIVG_SIZE).accepted).toBe(false);
  });
});

describe('synthetic fixtures (regression guard for the recommended tolerances)', () => {
  const fixtures = readdirSync(join(spikeDir, 'fixtures'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(spikeDir, 'fixtures', f), 'utf8')) as FixtureFile);

  it('covers 20 characters', () => {
    expect(fixtures).toHaveLength(20);
  });

  it('accepts good strokes and rejects bad ones at the default tolerances', () => {
    let good = 0;
    let goodAccepted = 0;
    let bad = 0;
    let badAccepted = 0;
    for (const f of fixtures) {
      const strokes = strokesOf(f.char);
      for (const a of f.attempts) {
        if (a.group !== 'good' && a.group !== 'bad') continue;
        const pts = a.points.map(([x, y]) => ({ x, y }));
        const ok = judgeStroke(
          pts,
          strokes,
          a.strokeIndex,
          f.canvasSize,
          DEFAULT_TOLERANCES,
        ).accepted;
        if (a.group === 'good') {
          good++;
          if (ok) goodAccepted++;
        } else {
          bad++;
          if (ok) badAccepted++;
        }
      }
    }
    expect(goodAccepted / good).toBeGreaterThanOrEqual(0.99);
    expect(badAccepted / bad).toBeLessThanOrEqual(0.01);
  });

  it('generates the same attempts for the same seed', () => {
    const a = generateAttempts('二', strokesOf('二'), KANJIVG_SIZE, 7, 1);
    const b = generateAttempts('二', strokesOf('二'), KANJIVG_SIZE, 7, 1);
    expect(a).toEqual(b);
  });
});

describe('Hanzi Writer data conversion', () => {
  it('maps KanjiVG space to Hanzi Writer space with y flipped', () => {
    expect(toHanziWriterSpace({ x: 0, y: 0 }, KANJIVG_SIZE)).toEqual({ x: 0, y: 900 });
    expect(toHanziWriterSpace({ x: 109, y: 109 }, KANJIVG_SIZE)).toEqual({ x: 1024, y: -124 });
  });

  it('builds one outline and one median per stroke', () => {
    const d = toHanziWriterData(strokesOf('口'), KANJIVG_SIZE);
    expect(d.strokes).toHaveLength(3);
    expect(d.medians).toHaveLength(3);
    expect(d.strokes[0]).toMatch(/^M .* Z$/);
  });
});

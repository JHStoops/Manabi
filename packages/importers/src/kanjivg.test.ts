import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { toHanziWriterSpace } from './hanziWriterData';
import { loadHanziWriter } from './hanziWriterHarness';
import { kanaItems, kanjiVgToHanziWriter, parseKanjiVg } from './kanjivg';

const FIXTURE = join(__dirname, '../fixtures/kanjivg.xml');

/** The spike's (#2) "neat" synthetic attempt at 水 stroke 1, in KanjiVG units. */
const NEAT_WATER_STROKE_1: Array<[number, number]> = [
  [53, 14.6], [53.4, 15.1], [53.5, 15.6], [53.9, 16.3], [54.5, 17.3], [54.9, 19.8], [54.7, 21.2],
  [54.9, 24.3], [54.4, 26.3], [54.6, 29.9], [54.3, 33], [54.7, 36.8], [54.1, 40.4], [54.4, 44.4],
  [54.1, 47.6], [54.1, 52.1], [54.9, 56.4], [55, 60], [54.8, 64.6], [55.3, 69.1], [54.4, 72.7],
  [54.6, 76.3], [54.4, 80.1], [54.3, 83.9], [54.3, 86.8], [54, 90.3], [53.2, 92.1], [50.6, 90.9],
  [49.2, 89.9], [47.6, 88.6], [46.5, 87.7], [45.5, 87.1], [45.8, 86.2], [45.3, 86.5],
]; // prettier-ignore

describe('parseKanjiVg (FR-226)', () => {
  it('reads the generation date and each standard character, skipping variants', async () => {
    const parsed = await parseKanjiVg(createReadStream(FIXTURE, 'utf8'));
    expect(parsed.datasetVersion).toBe('2026-07-14');
    expect([...parsed.strokes.keys()]).toEqual(['あ', '水', '逢']);
    expect(parsed.strokes.get('水')).toHaveLength(4);
    expect(parsed.strokes.get('水')![0]).toMatch(/^M52\.77,15\.08c/);
    // 逢's strokes sit in nested groups, with the radical drawn last.
    expect(parsed.strokes.get('逢')).toHaveLength(11);
    expect(parsed.strokes.get('逢')![10]).toMatch(/^M13\.25,84\.17/);
  });

  it('fails without a generation date', async () => {
    async function* input() {
      yield '<kanjivg></kanjivg>';
    }
    await expect(parseKanjiVg(input())).rejects.toThrow(/generated on/);
  });
});

describe('kanjiVgToHanziWriter (FR-077)', () => {
  const water = async () =>
    kanjiVgToHanziWriter(
      (await parseKanjiVg(createReadStream(FIXTURE, 'utf8'))).strokes.get('水')!,
    );

  it('converts 水 to 4 strokes in order, each an outline and a median in Hanzi Writer space', async () => {
    const data = await water();
    expect(data.strokes).toHaveLength(4);
    expect(data.medians).toHaveLength(4);
    for (const outline of data.strokes)
      expect(outline).toMatch(/^M -?\d+ -?\d+( L -?\d+ -?\d+)+ Z$/);
    for (const median of data.medians.flat()) {
      expect(median[0]).toBeGreaterThanOrEqual(0);
      expect(median[0]).toBeLessThanOrEqual(1024);
      expect(median[1]).toBeGreaterThanOrEqual(-124);
      expect(median[1]).toBeLessThanOrEqual(900);
    }
    // Stroke 1 starts at KanjiVG (52.77, 15.08): top centre, so high y in the y-up space.
    expect(data.medians[0]![0]).toEqual([496, 758]);
    // Stroke 2 starts at the left (17.5, 45.75).
    expect(data.medians[1]![0]).toEqual([164, 470]);
  });

  it('loads in Hanzi Writer, whose matcher accepts a drawn stroke 1 and rejects it reversed', async () => {
    const hw = loadHanziWriter();
    const character = hw.parseCharData('水', await water());
    const drawn = NEAT_WATER_STROKE_1.map(([x, y]) => toHanziWriterSpace({ x, y }, 109));
    const options = { leniency: 1, isOutlineVisible: true };
    expect(hw.strokeMatches({ points: drawn }, character, 0, options).isMatch).toBe(true);
    expect(hw.strokeMatches({ points: drawn.reverse() }, character, 0, options).isMatch).toBe(
      false,
    );
  });
});

describe('kanaItems', () => {
  it('keys each course kana ja:kana:<char>', () => {
    const items = kanaItems();
    expect(items).toHaveLength(142);
    expect(items[0]).toEqual({
      key: 'ja:kana:あ',
      type: 'kana',
      data: { character: 'あ', script: 'hiragana', romaji: 'a' },
    });
  });
});

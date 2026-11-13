import { join } from 'node:path';
import { readLevelLists } from './levelLists';

const FIXTURE = join(__dirname, '../fixtures/tanos');

describe('readLevelLists (FR-233, SDD section 10 step 2)', () => {
  it('parses the N5 and N4 fixture lists, keeping the easier level of a repeated entry', async () => {
    expect(await readLevelLists('N4', FIXTURE)).toEqual({
      datasetVersion: '2010-11-21',
      licence: 'CC BY',
      attribution: 'JLPT Resources by Jonathan Waller (tanos.co.uk)',
      levels: ['N5', 'N4'],
      kanji: [
        { key: 'ja:kanji:水', level: 'N5' },
        { key: 'ja:kanji:日', level: 'N5' },
      ],
      words: [
        { level: 'N5', written: '水', reading: 'みず' },
        { level: 'N5', written: 'あさって', reading: 'あさって' },
        { level: 'N4', written: '会う', reading: 'あう' },
      ],
    });
  });

  it('skips levels above the ceiling and levels with no files', async () => {
    expect((await readLevelLists('N3', FIXTURE)).levels).toEqual(['N5', 'N4']);
    const n2 = await readLevelLists('N2', FIXTURE);
    expect(n2.levels).toEqual(['N5', 'N4', 'N2']);
    expect(n2.kanji).toContainEqual({ key: 'ja:kanji:逢', level: 'N2' });
  });

  it('rejects a ceiling that is not a level', async () => {
    await expect(readLevelLists('N6', FIXTURE)).rejects.toThrow(/N6 is not one of N5, N4/);
  });

  it('reads the committed copy', async () => {
    const lists = await readLevelLists('N4');
    expect(lists.levels).toEqual(['N5', 'N4']);
    expect(lists.kanji).toHaveLength(79 + 166);
    expect(lists.words).toHaveLength(686 + 585);
    // Fixed in the copy (data/tanos/README.md).
    expect(lists.words).toContainEqual({ level: 'N5', written: '明るい', reading: 'あかるい' });
    expect(lists.words.some((w) => w.written === '明い')).toBe(false);
  });
});

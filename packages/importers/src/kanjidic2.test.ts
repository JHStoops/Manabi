import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { kanjiDataSchema } from '@manabi/lang-ja';
import { parseKanjidic2 } from './kanjidic2';

const KANJIDIC2_FIXTURE = join(__dirname, '../fixtures/kanjidic2.xml');

describe('parseKanjidic2 (FR-226)', () => {
  it('parses the fixture into kanji items keyed ja:kanji:<char>', async () => {
    const parsed = await parseKanjidic2(createReadStream(KANJIDIC2_FIXTURE, 'utf8'));

    expect(parsed).toEqual({
      datasetVersion: '2026-11-12',
      items: [
        {
          key: 'ja:kanji:水',
          type: 'kanji',
          data: {
            character: '水',
            meanings: ['water'],
            onReadings: ['スイ'],
            kunReadings: ['みず', 'みず-'],
            strokeCount: 4,
            components: ['水'],
          },
        },
        {
          key: 'ja:kanji:逢',
          type: 'kanji',
          data: {
            character: '逢',
            meanings: ['meeting', 'tryst'],
            onReadings: ['ホウ'],
            kunReadings: ['あ.う', 'むか.える'],
            strokeCount: 10,
            components: ['辵'],
          },
        },
      ],
    });
    for (const item of parsed.items) expect(() => kanjiDataSchema.parse(item.data)).not.toThrow();
  });

  it('reads chunks split mid-element', async () => {
    async function* chunks() {
      yield '<kanjidic2><header><date_of_creation>2026-01-';
      yield '02</date_of_creation></header><character><lit';
      yield 'eral>水</literal><misc><stroke_count>4</stroke_count></misc>';
      yield '<reading_meaning><rmgroup><meaning>wa';
      yield 'ter</meaning></rmgroup></reading_meaning></character></kanjidic2>';
    }
    const parsed = await parseKanjidic2(chunks());
    expect(parsed.datasetVersion).toBe('2026-01-02');
    expect(parsed.items.map((i) => i.data.meanings)).toEqual([['water']]);
  });

  it('rejects a file without a header version', async () => {
    async function* chunks() {
      yield '<kanjidic2></kanjidic2>';
    }
    await expect(parseKanjidic2(chunks())).rejects.toThrow(/date_of_creation/);
  });
});

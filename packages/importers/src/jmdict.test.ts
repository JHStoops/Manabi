import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { wordDataSchema } from '@manabi/lang-ja';
import { parseJmdict } from './jmdict';

const JMDICT_FIXTURE = join(__dirname, '../fixtures/jmdict.xml');

const parse = (wanted: [string, string][]) =>
  parseJmdict(
    createReadStream(JMDICT_FIXTURE, 'utf8'),
    wanted.map(([written, reading]) => ({ level: 'N5', written, reading })),
  );

describe('parseJmdict (FR-226, DR-02)', () => {
  it('imports each wanted word once, with its sense, and reports the unmatched ones', async () => {
    const parsed = await parse([
      ['水', 'みず'],
      ['水', 'みず'],
      ['逢う', 'あう'],
      ['遭う', 'あう'],
      ['上手', 'かみて'],
      ['ヒト', 'ヒト'],
      ['人', 'ヒト'],
      ['日', 'か'],
      ['陽', 'か'],
      ['猫', 'ねこ'],
    ]);

    expect(parsed.datasetVersion).toBe('2026-11-17');
    // Parts of speech are JMdict's entity codes, not the header's English text.
    expect(parsed.items.map((item) => [item.key, item.data.senses])).toEqual([
      // Non-English glosses are dropped.
      ['ja:word:水:みず', [{ partsOfSpeech: ['n'], meanings: ['water', 'cold water'] }]],
      // stagk excludes the 遭う sense.
      ['ja:word:逢う:あう', [{ partsOfSpeech: ['v5u', 'vi'], meanings: ['to meet', 'to see'] }]],
      // stagk picks the sense; parts of speech carry over from the sense before.
      [
        'ja:word:遭う:あう',
        [{ partsOfSpeech: ['v5u', 'vi'], meanings: ['to encounter (e.g. an accident)'] }],
      ],
      // stagr picks the sense for the second reading.
      [
        'ja:word:上手:かみて',
        [
          {
            partsOfSpeech: ['n'],
            meanings: ["upper stage (left side of the stage from the audience's view)"],
          },
        ],
      ],
      ['ja:word:ヒト:ヒト', [{ partsOfSpeech: ['n'], meanings: ['person'] }]],
      ['ja:word:日:か', [{ partsOfSpeech: ['n'], meanings: ['day'] }]],
    ]);
    // ヒト is never written 人 (re_nokanji); か is read only for 日 (re_restr).
    expect(parsed.unmatched).toEqual([
      { level: 'N5', written: '人', reading: 'ヒト' },
      { level: 'N5', written: '陽', reading: 'か' },
      { level: 'N5', written: '猫', reading: 'ねこ' },
    ]);
    for (const item of parsed.items) expect(() => wordDataSchema.parse(item.data)).not.toThrow();
    expect(parsed.links.filter((link) => link.from === 'ja:word:逢う:あう')).toEqual([
      { from: 'ja:word:逢う:あう', to: 'ja:kanji:逢' },
      { from: 'ja:word:逢う:あう', to: 'ja:kanji:う' },
    ]);
  });

  it('prefers the entry usually written in kana for a kana-only word', async () => {
    const parsed = await parse([
      ['要る', 'いる'],
      ['いる', 'いる'],
    ]);
    // 要る comes first in the file but is not usually written in kana. Every sense is kept, in
    // order, each with its own codes.
    expect(parsed.items.map((item) => [item.key, item.data.senses])).toEqual([
      ['ja:word:要る:いる', [{ partsOfSpeech: ['v5r'], meanings: ['to need'] }]],
      [
        'ja:word:いる:いる',
        [
          { partsOfSpeech: ['v1'], meanings: ['to be (of animate objects)', 'to exist'] },
          { partsOfSpeech: ['aux-v', 'v1'], meanings: ['to be ..-ing'] },
        ],
      ],
    ]);
    for (const item of parsed.items) expect(() => wordDataSchema.parse(item.data)).not.toThrow();
  });

  it('rejects a file without the creation date', async () => {
    async function* xml() {
      yield '<JMdict></JMdict>';
    }
    await expect(parseJmdict(xml(), [])).rejects.toThrow(/JMdict created/);
  });
});

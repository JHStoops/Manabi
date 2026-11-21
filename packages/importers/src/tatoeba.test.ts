import path from 'node:path';
import { japanese } from '@manabi/lang-ja';
import { parseTatoeba } from './tatoeba';

const dir = path.join(__dirname, '../fixtures/tatoeba');
const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
// 先生 is missing, so 私は先生です。 has an unknown word.
const wanted = [
  { level: 'N5', written: '水', reading: 'みず' },
  { level: 'N5', written: '私', reading: 'わたくし' },
  { level: 'N5', written: '私', reading: 'わたし' },
  { level: 'N5', written: '学生', reading: 'がくせい' },
  { level: 'N5', written: '今日', reading: 'きょう' },
  { level: 'N4', written: '暑い', reading: 'あつい' },
  { level: 'N4', written: '下さる', reading: 'くださる' },
];

describe('parseTatoeba (FR-235, FR-238, DR-11)', () => {
  it('keeps only native-owned, short, Latin-free sentences whose counted words are all known', async () => {
    const parsed = await parseTatoeba(dir, japanese, wanted, levels, []);

    expect(parsed.datasetVersion).toBe('2026-11-11');
    expect(parsed.dropped).toEqual({
      noTranslation: 1, // 4715: no link
      latin: 1, // 2975959: Tシャツ
      tooLong: 1, // 4740
      notNative: 2, // 112085 has no owner; bourdu declares no native Japanese
      blocked: 0,
      unknownWords: 1, // 155469: 先生
    });
    expect(parsed.sentences.map((s) => s.sentence.sourceId)).toEqual([
      '143718',
      '157843',
      '171592',
    ]);
  });

  it('uses the lowest-id translation, keeps the others and matches words by base form', async () => {
    const [water, student] = (await parseTatoeba(dir, japanese, wanted, levels, [])).sentences;

    expect(water).toEqual({
      sentence: { sourceId: '143718', text: '水をください。', owner: 'bunbuku' },
      translation: { sourceId: '64352', text: 'Can I have some water, please?', owner: 'CK' },
      otherTranslationIds: ['250149', '250150', '270848', '2132096'],
      tiles: [
        { surface: '水', base: '水', reading: 'みず', word: 'ja:word:水:みず' },
        { surface: 'を', base: 'を', reading: 'を', word: null },
        // Matched through the word's reading; the sentence takes its level.
        {
          surface: 'ください',
          base: 'くださる',
          reading: 'ください',
          word: 'ja:word:下さる:くださる',
        },
      ],
      vocabLevel: 'N4',
      grammar: [],
      grammarLevel: null,
    });
    // Of the homographs 私, the one read as the tile is picked.
    expect(student!.tiles[0]!.word).toBe('ja:word:私:わたし');
    expect(student!.vocabLevel).toBe('N5');
  });

  // FR-236. 私は学生です。 has N5 words; the points match its は and です.
  const wa = { key: 'wa', detection: [[{ base: 'は' }]] };
  const desu = { key: 'desu', detection: [[{ base: 'です' }]] };
  it.each([
    ['no point', [], [], null, {}],
    ['one next-level point', [{ ...wa, level: 'N4' }], ['wa'], 'N4', { N4: 1 }],
    [
      'several next-level points',
      [
        { ...wa, level: 'N4' },
        { ...desu, level: 'N4' },
      ],
      ['wa', 'desu'],
      'N4',
      { N4: 1 },
    ],
    [
      'a point two levels up',
      [
        { ...wa, level: 'N3' },
        { ...desu, level: 'N5' },
      ],
      ['wa', 'desu'],
      'N3',
      { N3: 2 }, // 今日は暑いです。 has N4 words and は too
    ],
    ['a point at the vocabulary level', [{ ...wa, level: 'N5' }], ['wa'], 'N5', {}],
  ])(
    'with %s, keeps the sentence and stores the highest detected level',
    async (_label, points, grammar, grammarLevel, challenging) => {
      const parsed = await parseTatoeba(dir, japanese, wanted, levels, points);

      expect(parsed.sentences).toHaveLength(3);
      expect(parsed.sentences[1]).toMatchObject({ vocabLevel: 'N5', grammar, grammarLevel });
      expect(parsed.challenging).toEqual(challenging);
    },
  );

  it('drops a sentence whose conjugated verb is blocked by its base form (FR-237)', async () => {
    // 水をください。: the tile ください has the base form くださる.
    const parsed = await parseTatoeba(dir, japanese, wanted, levels, [], new Set(['くださる']));

    expect(parsed.dropped).toMatchObject({ blocked: 1, unknownWords: 1 });
    expect(parsed.blockedIds).toEqual(['143718']);
    expect(parsed.sentences.map((s) => s.sentence.sourceId)).toEqual(['157843', '171592']);
  });

  it('fails without a dataset version', async () => {
    await expect(parseTatoeba(__dirname, japanese, wanted, levels, [])).rejects.toThrow();
  });
});

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
    const parsed = await parseTatoeba(dir, japanese, wanted, levels);

    expect(parsed.datasetVersion).toBe('2026-11-11');
    expect(parsed.dropped).toEqual({
      noTranslation: 1, // 4715: no link
      latin: 1, // 2975959: Tシャツ
      tooLong: 1, // 4740
      notNative: 2, // 112085 has no owner; bourdu declares no native Japanese
      unknownWords: 1, // 155469: 先生
    });
    expect(parsed.sentences.map((s) => s.sentence.sourceId)).toEqual([
      '143718',
      '157843',
      '171592',
    ]);
  });

  it('uses the lowest-id translation, keeps the others and matches words by base form', async () => {
    const [water, student] = (await parseTatoeba(dir, japanese, wanted, levels)).sentences;

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
    });
    // Of the homographs 私, the one read as the tile is picked.
    expect(student!.tiles[0]!.word).toBe('ja:word:私:わたし');
    expect(student!.vocabLevel).toBe('N5');
  });

  it('fails without a dataset version', async () => {
    await expect(parseTatoeba(__dirname, japanese, wanted, levels)).rejects.toThrow();
  });
});

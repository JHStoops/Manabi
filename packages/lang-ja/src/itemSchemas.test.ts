import { parseItemData } from '@manabi/core';
import type { z } from '@manabi/core';
import japanese from './index';
import { grammarDataSchema, kanaDataSchema, kanjiDataSchema, wordDataSchema } from './itemSchemas';

function describeSchema(
  name: string,
  schema: z.ZodTypeAny,
  valid: ReadonlyArray<readonly [string, unknown]>,
  invalid: ReadonlyArray<readonly [string, unknown]>,
): void {
  describe(name, () => {
    it.each(valid)('accepts %s', (_label, value) => {
      expect(schema.safeParse(value).error?.issues).toBeUndefined();
    });
    it.each(invalid)('rejects %s', (_label, value) => {
      expect(schema.safeParse(value).success).toBe(false);
    });
  });
}

describeSchema(
  'kanaDataSchema',
  kanaDataSchema,
  [
    ['hiragana', { character: 'か', script: 'hiragana', romaji: 'ka' }],
    ['katakana', { character: 'キャ', script: 'katakana', romaji: 'kya' }],
  ],
  [
    ['a script mismatch', { character: 'カ', script: 'hiragana', romaji: 'ka' }],
    ['uppercase romaji', { character: 'か', script: 'hiragana', romaji: 'KA' }],
    ['an unknown script', { character: 'か', script: 'kanji', romaji: 'ka' }],
    ['an extra field', { character: 'か', script: 'hiragana', romaji: 'ka', x: 1 }],
  ],
);

const kanji = {
  character: '水',
  meanings: ['water'],
  onReadings: ['スイ'],
  kunReadings: ['みず', 'みず-'],
  strokeCount: 4,
};

describeSchema(
  'kanjiDataSchema',
  kanjiDataSchema,
  [
    ['a kanji', kanji],
    ['a kanji with components', { ...kanji, components: ['水'] }],
    ['an astral kanji', { ...kanji, character: '𠮷' }],
    ['okurigana marked with a dot', { ...kanji, kunReadings: ['た.べる'] }],
  ],
  [
    ['two characters', { ...kanji, character: '水水' }],
    ['no meanings', { ...kanji, meanings: [] }],
    ['a romaji reading', { ...kanji, onReadings: ['sui'] }],
    ['zero strokes', { ...kanji, strokeCount: 0 }],
  ],
);

const word = { written: '水', reading: 'みず', senses: [{ meanings: ['water'] }] };

describeSchema(
  'wordDataSchema',
  wordDataSchema,
  [
    ['a word', word],
    [
      'a word with several senses and parts of speech',
      {
        ...word,
        senses: [
          { partsOfSpeech: ['n'], meanings: ['water'] },
          { partsOfSpeech: ['n', 'n-pref'], meanings: ['fluid', 'liquid'] },
        ],
      },
    ],
  ],
  [
    ['a kanji reading', { ...word, reading: '水' }],
    ['no senses', { ...word, senses: [] }],
    ['a sense without meanings', { ...word, senses: [{ meanings: [] }] }],
    ['the old flat meanings', { written: '水', reading: 'みず', meanings: ['water'] }],
    ['an empty written form', { ...word, written: '' }],
  ],
);

describeSchema(
  'grammarDataSchema',
  grammarDataSchema,
  [
    ['a stub', { pattern: 'Verb-te + kudasai' }],
    [
      'a full point',
      {
        pattern: 'Verb-te + kudasai',
        meaning: 'Please do',
        themes: ['requests'],
        formation: [{ wordType: 'Verb', form: 'te-form + ください', example: '食べてください' }],
        explanation: 'A polite request.',
        detection: [[{ surface: 'て' }, { base: 'くださる', pos: ['動詞'] }]],
      },
    ],
  ],
  [
    ['no pattern', { meaning: 'Please do' }],
    ['a bad formation row', { pattern: 'x', formation: [{ wordType: 'Verb' }] }],
    ['an empty detection pattern', { pattern: 'x', detection: [[]] }],
    ['an empty matcher', { pattern: 'x', detection: [[{}]] }],
    ['an unknown matcher field', { pattern: 'x', detection: [[{ reading: 'テ' }]] }],
    ['a pattern that is not a list', { pattern: 'x', detection: [{ base: 'て' }] }],
  ],
);

describe('japanese.itemSchemas', () => {
  it('defines the four Japanese item types', () => {
    expect(Object.keys(japanese.itemSchemas).sort()).toEqual(['grammar', 'kana', 'kanji', 'word']);
  });

  it('validates item data through the core helper (DR-06)', () => {
    expect(parseItemData(japanese, 'word', word)).toEqual({
      ...word,
      senses: [{ partsOfSpeech: [], meanings: ['water'] }],
    });
    expect(() => parseItemData(japanese, 'sentence', {})).toThrow('no item type "sentence"');
  });
});

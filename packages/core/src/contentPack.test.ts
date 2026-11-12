import {
  ContentPackError,
  packCourseSchema,
  packGrammarFrontMatterSchema,
  packItemSchema,
  packSentenceSchema,
  packUnitSchema,
} from './index';
import { describeSchema } from './testCases';

const course = {
  key: 'ja-en',
  targetLang: 'ja',
  baseLang: 'en',
  plugin: 'ja',
  title: 'Japanese for English speakers',
  sections: [{ key: 'ja-en:n5', title: 'N5', level: 'N5' }],
};

describeSchema(
  'packCourseSchema',
  packCourseSchema,
  [
    ['a course', course],
    [
      'a course with N2 and N1 sections added as data (FR-244)',
      {
        ...course,
        sections: [
          ...course.sections,
          { key: 'ja-en:n2', title: 'N2', level: 'N2' },
          { key: 'ja-en:n1', title: 'N1', level: 'N1' },
        ],
      },
    ],
  ],
  [
    ['a section without a level', { ...course, sections: [{ key: 'ja-en:n5', title: 'N5' }] }],
    ['an unknown field', { ...course, id: 'ja-en' }],
  ],
);

describeSchema(
  'packUnitSchema',
  packUnitSchema,
  [
    [
      'a unit',
      {
        key: 'u',
        section: 'ja-en:n5',
        title: 'Food',
        lessons: [{ key: 'l', type: 'vocabulary', title: 'Drinks', items: ['ja:word:水:みず'] }],
      },
    ],
  ],
  [
    [
      'an unknown lesson type',
      { key: 'u', section: 's', title: 'U', lessons: [{ key: 'l', type: 'boss', title: 'L' }] },
    ],
  ],
);

describeSchema(
  'packItemSchema',
  packItemSchema,
  [
    [
      'an authored item',
      { key: 'ja:kana:あ', type: 'kana', level: 'kana', data: { character: 'あ' } },
    ],
    [
      'overrides on an imported item',
      { key: 'ja:kanji:水', type: 'kanji', overrides: { meanings: ['water'] } },
    ],
  ],
  [
    ['an item without a type', { key: 'ja:kanji:水', overrides: {} }],
    ['a level on an imported item', { key: 'ja:kanji:水', type: 'kanji', level: 'N5' }],
  ],
);

describeSchema(
  'packGrammarFrontMatterSchema',
  packGrammarFrontMatterSchema,
  [
    [
      'a stub with data fields',
      { key: 'ja:grammar:te-kudasai', level: 'N5', pattern: '〜てください' },
    ],
  ],
  [['related points that are not keys', { key: 'k', related: ['has space'] }]],
);

const attribution = {
  sourceId: '1',
  owner: null,
  url: 'https://tatoeba.org/sentences/show/1',
  licence: 'CC BY 2.0 FR',
  datasetVersion: '2026-10-01',
};
const sentence = {
  text: '水です。',
  translation: 'It is water.',
  tiles: [{ surface: '水', base: '水', reading: 'みず', item: 'ja:word:水:みず' }],
};

describeSchema(
  'packSentenceSchema',
  packSentenceSchema,
  [
    ['an authored sentence', sentence],
    [
      'an imported sentence',
      {
        ...sentence,
        source: 'tatoeba',
        sourceId: '1',
        attribution: { sentence: attribution, translation: attribution },
      },
    ],
  ],
  [
    ['a source without a source id', { ...sentence, source: 'tatoeba' }],
    ['an imported sentence without attribution', { ...sentence, source: 'tatoeba', sourceId: '1' }],
    [
      'a tile with an item id instead of a key',
      { ...sentence, tiles: [{ surface: '水', base: '水', reading: 'みず', itemId: 1 }] },
    ],
  ],
);

it('ContentPackError lists every problem', () => {
  const err = new ContentPackError(['a.yaml: x: bad', 'b.yaml: y: bad']);
  expect(err.message).toBe('a.yaml: x: bad\nb.yaml: y: bad');
  expect(err.name).toBe('ContentPackError');
});

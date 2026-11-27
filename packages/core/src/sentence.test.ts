import {
  acceptListSchema,
  answerCheckPayloadSchema,
  answerTextSchema,
  attributionPartSchema,
  reviewStatusSchema,
  sentenceAttributionSchema,
  sentenceSchema,
  tileSchema,
} from './index';
import { describeSchema } from './testCases';

const tile = { surface: '食べました', base: '食べる', reading: 'たべました', itemId: 7 };

describeSchema(
  'tileSchema',
  tileSchema,
  [
    ['a linked tile', tile],
    ['a tile without an item id', { surface: 'は', base: 'は', reading: 'は' }],
    ['a tile with a null item id', { ...tile, itemId: null }],
  ],
  [
    ['an empty surface', { ...tile, surface: '' }],
    ['a missing reading', { surface: 'は', base: 'は' }],
    ['an item key instead of an id', { ...tile, itemId: 'ja:word:食べる' }],
    ['an unknown field', { ...tile, pos: 'verb' }],
  ],
);

describeSchema(
  'answerTextSchema',
  answerTextSchema,
  [
    ['answer text with tiles', { text: '食べました', tiles: [tile] }],
    ['answer text without tiles yet', { text: 'eat', tiles: [] }],
  ],
  [
    ['empty text', { text: '', tiles: [] }],
    ['missing tiles', { text: '食べました' }],
  ],
);

describeSchema(
  'acceptListSchema',
  acceptListSchema,
  [
    ['one answer', [{ text: 'water', tiles: [] }]],
    ['a report-accepted answer (#251)', [{ text: 'water', tiles: [], source: 'report' }]],
  ],
  [
    ['an empty list', []],
    ['a bare string', ['water']],
    ['an unknown answer source', [{ text: 'water', tiles: [], source: 'pack' }]],
  ],
);

describeSchema(
  'answerCheckPayloadSchema',
  answerCheckPayloadSchema,
  [
    ['an accept list', { accept: [{ text: 'water', tiles: [] }] }],
    ['a kanji-testing payload', { accept: [{ text: '水', tiles: [] }], testsKanji: true }],
  ],
  [
    ['no accept list', { testsKanji: true }],
    ['a non-boolean testsKanji', { accept: [{ text: '水', tiles: [] }], testsKanji: 'yes' }],
  ],
);

describeSchema(
  'reviewStatusSchema',
  reviewStatusSchema,
  [
    ['unreviewed', 'unreviewed'],
    ['flagged', 'flagged'],
    ['reviewed', 'reviewed'],
  ],
  [['approved', 'approved']],
);

const part = {
  sourceId: '12345',
  owner: 'someone',
  url: 'https://tatoeba.org/sentences/show/12345',
  licence: 'CC BY 2.0 FR',
  datasetVersion: '2026-10-01',
};

describeSchema(
  'attributionPartSchema',
  attributionPartSchema,
  [
    ['a part with an owner', part],
    ['a part without an owner', { ...part, owner: null }],
  ],
  [
    ['a bad URL', { ...part, url: 'not a url' }],
    ['a missing licence', { ...part, licence: undefined }],
  ],
);

describeSchema(
  'sentenceAttributionSchema',
  sentenceAttributionSchema,
  [
    ['both sides', { sentence: part, translation: { ...part, sourceId: '678' } }],
    [
      'other translations',
      { sentence: part, translation: part, otherTranslationIds: ['679', '680'] },
    ],
  ],
  [
    ['only the sentence', { sentence: part }],
    [
      'an empty other translation id',
      { sentence: part, translation: part, otherTranslationIds: [''] },
    ],
  ],
);

const sentence = {
  id: 8,
  courseId: 1,
  text: '水を飲みます。',
  tokens: [
    { surface: '水', base: '水', reading: 'みず', itemId: 5 },
    { surface: 'を', base: 'を', reading: 'を' },
    { surface: '飲みます', base: '飲む', reading: 'のみます' },
  ],
  translation: 'I drink water.',
  source: 'tatoeba',
  sourceId: '12345',
  attribution: { sentence: part, translation: part },
  reviewStatus: 'unreviewed',
  grammar: ['ja:grammar:masu'],
  vocabLevelCode: 'N5',
  grammarLevelCode: 'N5',
  challengeOverride: null,
  edited: false,
  translationEdited: false,
  tokensEdited: false,
  archivedAt: null,
};

const authored = {
  ...sentence,
  source: null,
  sourceId: null,
  attribution: null,
  reviewStatus: 'reviewed',
  grammar: [],
  grammarLevelCode: null,
  challengeOverride: true,
};

describeSchema(
  'sentenceSchema',
  sentenceSchema,
  [
    ['an imported sentence', sentence],
    ['an authored sentence with an override and no grammar level', authored],
    ['a sentence without levelled words', { ...authored, vocabLevelCode: null }],
  ],
  [
    ['a source without a source id', { ...sentence, sourceId: null }],
    ['a source id without a source', { ...authored, sourceId: '1' }],
    ['an imported sentence without attribution', { ...sentence, attribution: null }],
    ['an unknown review status', { ...sentence, reviewStatus: 'approved' }],
    ['a bad level code', { ...sentence, grammarLevelCode: 'N 4' }],
    ['a string challenge override', { ...sentence, challengeOverride: 'yes' }],
    ['a bad tile', { ...sentence, tokens: [{ surface: '水' }] }],
    ['an empty translation', { ...sentence, translation: '' }],
  ],
);

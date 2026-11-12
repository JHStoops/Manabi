import {
  idParamSchema,
  idSchema,
  jsonObjectSchema,
  langCodeSchema,
  levelCodeSchema,
  localDateSchema,
  nonEmptyTextSchema,
  pluginIdSchema,
  publishStatusSchema,
  stableKeySchema,
  timestampSchema,
  typeIdSchema,
} from './index';
import { describeSchema } from './testCases';

describeSchema(
  'idSchema',
  idSchema,
  [
    ['1', 1],
    ['a large id', 9_007_199_254_740_991],
  ],
  [
    ['zero', 0],
    ['a negative id', -1],
    ['a fraction', 1.5],
    ['a string', '1'],
    ['an unsafe integer', 9_007_199_254_740_992],
  ],
);

describeSchema(
  'idParamSchema',
  idParamSchema,
  [
    ['"1"', '1'],
    ['"42"', '42'],
  ],
  [
    ['"0"', '0'],
    ['a leading zero', '01'],
    ['letters', 'abc'],
    ['a fraction', '1.5'],
    ['a padded number', ' 1'],
    ['a number', 1],
  ],
);

describe('idParamSchema', () => {
  it('parses to a number', () => {
    expect(idParamSchema.parse('42')).toBe(42);
  });
});

describeSchema(
  'levelCodeSchema',
  levelCodeSchema,
  [
    ['kana', 'kana'],
    ['N5', 'N5'],
    ['a code with - and _', 'hsk_1-a'],
  ],
  [
    ['empty', ''],
    ['a leading dash', '-N5'],
    ['a space', 'N 5'],
    ['33 characters', 'a'.repeat(33)],
  ],
);

describeSchema(
  'stableKeySchema',
  stableKeySchema,
  [
    ['a course key', 'ja-en'],
    ['a kanji key', 'ja:kanji:水'],
    ['200 characters', 'k'.repeat(200)],
  ],
  [
    ['empty', ''],
    ['whitespace', 'ja word'],
    ['201 characters', 'k'.repeat(201)],
  ],
);

describeSchema(
  'langCodeSchema',
  langCodeSchema,
  [
    ['ja', 'ja'],
    ['yue', 'yue'],
  ],
  [
    ['uppercase', 'JA'],
    ['a region', 'ja-JP'],
    ['one letter', 'j'],
  ],
);

describeSchema(
  'pluginIdSchema',
  pluginIdSchema,
  [
    ['ja', 'ja'],
    ['with a dash', 'zh-hans'],
  ],
  [
    ['a leading digit', '1ja'],
    ['uppercase', 'Ja'],
  ],
);

describeSchema(
  'typeIdSchema',
  typeIdSchema,
  [
    ['kanji', 'kanji'],
    ['with an underscore', 'review_correct'],
  ],
  [
    ['a dash', 'multiple-choice'],
    ['uppercase', 'Kanji'],
    ['empty', ''],
  ],
);

describeSchema('nonEmptyTextSchema', nonEmptyTextSchema, [['text', 'a']], [['empty', '']]);

describeSchema(
  'timestampSchema',
  timestampSchema,
  [
    ['UTC', '2026-11-11T09:30:00Z'],
    ['UTC with milliseconds', '2026-11-11T09:30:00.123Z'],
  ],
  [
    ['an offset', '2026-11-11T09:30:00+09:00'],
    ['a date only', '2026-11-11'],
  ],
);

describeSchema(
  'localDateSchema',
  localDateSchema,
  [['a date', '2026-11-11']],
  [
    ['a timestamp', '2026-11-11T00:00:00Z'],
    ['an impossible date', '2026-02-30'],
  ],
);

describeSchema(
  'jsonObjectSchema',
  jsonObjectSchema,
  [
    ['an empty object', {}],
    ['an object', { a: [1] }],
  ],
  [
    ['an array', []],
    ['null', null],
  ],
);

describeSchema(
  'publishStatusSchema',
  publishStatusSchema,
  [
    ['draft', 'draft'],
    ['published', 'published'],
  ],
  [['archived', 'archived']],
);

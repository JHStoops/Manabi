import type { LanguagePlugin } from './index';
import {
  courseSchema,
  exerciseOriginSchema,
  itemLinkSchema,
  itemSchema,
  lessonSchema,
  lessonTypeSchema,
  parseItemData,
  sectionSchema,
  storedExerciseSchema,
  UnknownItemTypeError,
  unitSchema,
  z,
} from './index';
import { describeSchema } from './testCases';

const course = {
  id: 1,
  key: 'ja-en',
  targetLang: 'ja',
  baseLang: 'en',
  plugin: 'ja',
  title: 'Japanese for English speakers',
  status: 'draft',
};

describeSchema(
  'courseSchema',
  courseSchema,
  [
    ['a draft course', course],
    ['a published course', { ...course, status: 'published' }],
  ],
  [
    ['a bad language code', { ...course, targetLang: 'Japanese' }],
    ['an empty title', { ...course, title: '' }],
    ['an unknown status', { ...course, status: 'archived' }],
    ['a missing plugin', { ...course, plugin: undefined }],
  ],
);

const section = {
  id: 2,
  courseId: 1,
  key: 'ja-en:n5',
  position: 0,
  title: 'N5',
  levelCode: 'N5',
  archivedAt: null,
};

describeSchema(
  'sectionSchema',
  sectionSchema,
  [
    ['a section', section],
    ['an archived section', { ...section, archivedAt: '2026-11-11T00:00:00Z' }],
  ],
  [
    ['a negative position', { ...section, position: -1 }],
    ['a bad level code', { ...section, levelCode: 'N 5' }],
    ['a missing level code', { ...section, levelCode: null }],
  ],
);

const unit = {
  id: 3,
  sectionId: 2,
  key: 'ja-en:n5:food',
  position: 1,
  title: 'Food and ordering',
  status: 'published',
  archivedAt: null,
};

describeSchema(
  'unitSchema',
  unitSchema,
  [['a unit', unit]],
  [
    ['a fractional position', { ...unit, position: 1.5 }],
    ['a whitespace key', { ...unit, key: 'food unit' }],
  ],
);

describeSchema(
  'lessonTypeSchema',
  lessonTypeSchema,
  ['kana', 'vocabulary', 'kanji', 'grammar', 'listening', 'unit_review'].map(
    (type) => [type, type] as const,
  ),
  [
    ['the display name "unit review"', 'unit review'],
    ['test_out', 'test_out'],
  ],
);

const lesson = {
  id: 4,
  unitId: 3,
  key: 'ja-en:n5:food:1',
  position: 0,
  type: 'vocabulary',
  title: 'Counting dishes',
  status: 'draft',
  archivedAt: null,
};

describeSchema(
  'lessonSchema',
  lessonSchema,
  [
    ['a lesson', lesson],
    ['a unit review', { ...lesson, type: 'unit_review' }],
  ],
  [
    ['an unknown type', { ...lesson, type: 'reading' }],
    ['an empty title', { ...lesson, title: '' }],
  ],
);

const item = {
  id: 5,
  courseId: 1,
  key: 'ja:kanji:水',
  type: 'kanji',
  levelCode: 'N5',
  data: { character: '水' },
  overrides: {},
  source: 'kanjidic2',
  datasetVersion: '2026-01',
  archivedAt: null,
};

describeSchema(
  'itemSchema',
  itemSchema,
  [
    ['an imported item', item],
    [
      'an authored item without a level',
      { ...item, levelCode: null, source: null, datasetVersion: null },
    ],
  ],
  [
    ['a dataset version without a source', { ...item, source: null }],
    ['a bad type id', { ...item, type: 'Kanji' }],
    ['array data', { ...item, data: [] }],
    ['an empty source', { ...item, source: '' }],
  ],
);

describeSchema(
  'itemLinkSchema',
  itemLinkSchema,
  [
    ['contains', { fromItemId: 1, toItemId: 2, kind: 'contains' }],
    ['component', { fromItemId: 1, toItemId: 2, kind: 'component' }],
  ],
  [
    ['a self link', { fromItemId: 1, toItemId: 1, kind: 'related' }],
    ['an unknown kind', { fromItemId: 1, toItemId: 2, kind: 'synonym' }],
  ],
);

describeSchema(
  'exerciseOriginSchema',
  exerciseOriginSchema,
  [
    ['authored', 'authored'],
    ['generated', 'generated'],
    ['pinned', 'pinned'],
  ],
  [['imported', 'imported']],
);

const exercise = {
  id: 6,
  lessonId: 4,
  itemId: null,
  type: 'typed_answer',
  payload: { prompt: '水' },
  origin: 'authored',
};

describeSchema(
  'storedExerciseSchema',
  storedExerciseSchema,
  [
    ['a lesson exercise', exercise],
    ['an item exercise', { ...exercise, lessonId: null, itemId: 5, origin: 'pinned' }],
  ],
  [
    ['no owner', { ...exercise, lessonId: null }],
    ['a payload array', { ...exercise, payload: [] }],
    ['an unknown origin', { ...exercise, origin: 'copied' }],
  ],
);

describe('parseItemData', () => {
  const plugin = {
    code: 'xx',
    itemSchemas: { word: z.object({ written: z.string() }).strict() },
  } as unknown as LanguagePlugin;

  it('validates data with the plugin schema for the item type (DR-06)', () => {
    expect(parseItemData(plugin, 'word', { written: 'mizu' })).toEqual({ written: 'mizu' });
    expect(() => parseItemData(plugin, 'word', { written: 1 })).toThrow(z.ZodError);
  });

  it('rejects an item type the plugin does not define', () => {
    expect(() => parseItemData(plugin, 'kanji', {})).toThrow(UnknownItemTypeError);
    expect(() => parseItemData(plugin, 'toString', {})).toThrow(
      'Language plugin "xx" has no item type "toString"',
    );
  });
});

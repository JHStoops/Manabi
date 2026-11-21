import { datasetFileSchema, startImportRequestSchema, updateUserRequestSchema } from './index';
import { describeSchema } from './testCases';

describeSchema(
  'datasetFileSchema',
  datasetFileSchema,
  [
    ['a file in a folder', 'jmdict/JMdict_e'],
    ['a folder', 'tatoeba'],
    ['dots inside a name', 'kanjivg/kanjivg..xml'],
  ],
  [
    ['empty', ''],
    ['an absolute path', '/etc/passwd'],
    ['a Windows drive', 'C:\\data'],
    ['a parent segment', '../secrets'],
    ['a nested parent segment', 'jmdict/../../etc/passwd'],
    ['a backslash parent segment', 'jmdict\\..\\..\\x'],
    ['a NUL byte', 'jmdict\0'],
  ],
);

describeSchema(
  'startImportRequestSchema',
  startImportRequestSchema,
  [
    ['an importer with a file', { importer: 'jmdict', courseKey: 'ja-en', file: 'jmdict/x' }],
    ['the default file', { importer: 'level-lists', courseKey: 'ja-en' }],
  ],
  [
    ['an unknown importer', { importer: 'wikipedia', courseKey: 'ja-en' }],
    ['a traversing file', { importer: 'jmdict', courseKey: 'ja-en', file: '../x' }],
  ],
);

describeSchema(
  'updateUserRequestSchema',
  updateUserRequestSchema,
  [
    ['a role', { role: 'admin' }],
    ['disabling', { disabled: true }],
  ],
  [
    ['nothing', {}],
    ['an unknown role', { role: 'author' }],
  ],
);

import {
  avatarColorSchema,
  avatarInitialSchema,
  colorModeSchema,
  dailyGoalSchema,
  defaultLearnerSettings,
  learnerSettingsPatchSchema,
  learnerSettingsSchema,
  readingAnnotationModeSchema,
  textSizeSchema,
  themeSchema,
} from './index';
import { describeSchema } from './testCases';

describe('learner setting defaults (Product Spec sections 7, 8, 10, 11)', () => {
  const parsed = learnerSettingsSchema.parse({});

  it('fills every setting from an empty object', () => {
    expect(parsed).toEqual(defaultLearnerSettings);
  });

  it.each([
    ['newItemCap', 20],
    ['reviewCap', 100],
    ['readingAnnotations', 'unlearned'],
    ['theme', 'sakura'],
    ['dailyGoal', 20],
    ['drawingExercises', true],
    ['preferWordBank', false],
    ['colorMode', 'system'],
    ['targetTextSize', 'normal'],
    ['soundEffects', true],
    ['audioAutoplay', true],
    ['reducedMotion', false],
    ['appearOnLeaderboard', true],
    ['allowNudges', true],
    ['avatarColor', null],
    ['avatarInitial', null],
    ['activeCourseId', null],
  ] as const)('defaults %s to %p', (key, value) => {
    expect(parsed[key]).toBe(value);
  });

  it('has a test for every default', () => {
    expect(Object.keys(defaultLearnerSettings)).toHaveLength(17);
  });

  it('keeps stored values, fills missing ones and drops unknown keys', () => {
    const stored = learnerSettingsSchema.parse({ theme: 'umi', retired: 1 });
    expect(stored.theme).toBe('umi');
    expect(stored.newItemCap).toBe(20);
    expect(stored).not.toHaveProperty('retired');
  });
});

describeSchema(
  'learnerSettingsSchema',
  learnerSettingsSchema,
  [
    ['empty settings', {}],
    ['every setting', { ...defaultLearnerSettings, avatarColor: '#FF8800', avatarInitial: 'あ' }],
    ['a zero new-item cap', { newItemCap: 0 }],
  ],
  [
    ['a daily goal of 15', { dailyGoal: 15 }],
    ['a negative new-item cap', { newItemCap: -1 }],
    ['a zero review cap', { reviewCap: 0 }],
    ['a review cap over the maximum', { reviewCap: 1001 }],
    ['an unknown theme', { theme: 'neon' }],
    ['a string toggle', { soundEffects: 'yes' }],
  ],
);

describeSchema(
  'learnerSettingsPatchSchema',
  learnerSettingsPatchSchema,
  [
    ['an empty patch', {}],
    ['one field', { theme: 'sumi' }],
    ['clearing the avatar color', { avatarColor: null }],
  ],
  [
    ['an unknown key', { furigana: 'never' }],
    ['the active course, which only enrollment sets', { activeCourseId: 1 }],
    ['a bad value', { readingAnnotations: 'sometimes' }],
  ],
);

describe('learnerSettingsPatchSchema', () => {
  it('does not fill defaults, so only sent fields change', () => {
    expect(learnerSettingsPatchSchema.parse({ theme: 'sumi' })).toEqual({ theme: 'sumi' });
  });
});

describeSchema(
  'dailyGoalSchema',
  dailyGoalSchema,
  [10, 20, 30, 50].map((goal) => [String(goal), goal] as const),
  [
    ['40', 40],
    ['"20"', '20'],
  ],
);

describeSchema(
  'themeSchema',
  themeSchema,
  ['sakura', 'matcha', 'umi', 'yuyake', 'sumi'].map((theme) => [theme, theme] as const),
  [['Sakura', 'Sakura']],
);

describeSchema(
  'colorModeSchema',
  colorModeSchema,
  ['system', 'light', 'dark'].map((mode) => [mode, mode] as const),
  [['auto', 'auto']],
);

describeSchema(
  'readingAnnotationModeSchema',
  readingAnnotationModeSchema,
  ['always', 'unlearned', 'never'].map((mode) => [mode, mode] as const),
  [['unlearned_only', 'unlearned_only']],
);

describeSchema(
  'textSizeSchema',
  textSizeSchema,
  [
    ['normal', 'normal'],
    ['large', 'large'],
  ],
  [['small', 'small']],
);

describeSchema(
  'avatarColorSchema',
  avatarColorSchema,
  [['#ff88aa', '#ff88aa']],
  [
    ['a short hex color', '#f8a'],
    ['a name', 'pink'],
  ],
);

describeSchema(
  'avatarInitialSchema',
  avatarInitialSchema,
  [
    ['a letter', 'J'],
    ['a kana', 'じ'],
    ['an astral character', '𠮷'],
  ],
  [
    ['empty', ''],
    ['two letters', 'JS'],
    ['a space', ' '],
  ],
);

import { z } from 'zod';
import { lessonTypeSchema } from './content';
import {
  jsonObjectSchema,
  langCodeSchema,
  levelCodeSchema,
  nonEmptyTextSchema,
  pluginIdSchema,
  publishStatusSchema,
  stableKeySchema,
  typeIdSchema,
} from './primitives';
import { reviewStatusSchema, sentenceAttributionSchema } from './sentence';

/**
 * Content pack files (SDD section 4, FR-227). Everything is addressed by stable key (DR-02);
 * import resolves keys to row ids and export writes them back. Levels and sections are plain
 * data in course.yaml (FR-244).
 */

/** `course.yaml`: the course and its sections, in path order. */
export const packCourseSchema = z
  .object({
    key: stableKeySchema,
    targetLang: langCodeSchema,
    baseLang: langCodeSchema,
    plugin: pluginIdSchema,
    title: nonEmptyTextSchema,
    status: publishStatusSchema.default('draft'),
    sections: z.array(
      z
        .object({ key: stableKeySchema, title: nonEmptyTextSchema, level: levelCodeSchema })
        .strict(),
    ),
  })
  .strict();
export type PackCourse = z.infer<typeof packCourseSchema>;

/** One lesson inside a unit file. `items` are the keys of the new items it teaches, in order. */
export const packLessonSchema = z
  .object({
    key: stableKeySchema,
    type: lessonTypeSchema,
    title: nonEmptyTextSchema,
    status: publishStatusSchema.default('draft'),
    items: z.array(stableKeySchema).default([]),
    // STUB: hand-written exercises join the unit files with the exercise types and their tile
    // segmentation (#43, #59, #109).
  })
  .strict();
export type PackLesson = z.infer<typeof packLessonSchema>;

/** `units/<nn>-<slug>.yaml`. Files sort into path order; `section` is a section key. */
export const packUnitSchema = z
  .object({
    key: stableKeySchema,
    section: stableKeySchema,
    title: nonEmptyTextSchema,
    status: publishStatusSchema.default('draft'),
    lessons: z.array(packLessonSchema),
  })
  .strict();
export type PackUnit = z.infer<typeof packUnitSchema>;

/**
 * One entry of `items/<type>.yaml`. An authored item gives its `data` (validated by the plugin's
 * item schema, DR-06). An item from a dataset importer gives only `overrides` (DR-09).
 */
export const packItemSchema = z
  .object({
    key: stableKeySchema,
    type: typeIdSchema,
    level: levelCodeSchema.nullable().default(null),
    data: jsonObjectSchema.optional(),
    overrides: jsonObjectSchema.default({}),
  })
  .strict()
  .refine((item) => item.data !== undefined || item.level === null, {
    message: 'Only an authored item (one with data) sets a level',
    path: ['level'],
  });
export type PackItem = z.infer<typeof packItemSchema>;
export const packItemsFileSchema = z.array(packItemSchema);

/**
 * Front matter of `grammar/<slug>.md`, one authored item of type `grammar`. The envelope fields
 * are listed here; every other field is the item's `data`, and the Markdown body is stored as
 * `data.explanation`. A stub has no body.
 */
export const packGrammarFrontMatterSchema = z
  .object({
    key: stableKeySchema,
    level: levelCodeSchema.nullable().default(null),
    /** Keys of related grammar points (`item_links` of kind `related`). */
    related: z.array(stableKeySchema).default([]),
    overrides: jsonObjectSchema.default({}),
  })
  .passthrough();
export type PackGrammarFrontMatter = z.infer<typeof packGrammarFrontMatterSchema>;

/** DR-12 tile in a pack file: the stored tile shape with the item named by key, not id. */
export const packTileSchema = z
  .object({
    surface: nonEmptyTextSchema,
    base: nonEmptyTextSchema,
    reading: nonEmptyTextSchema,
    item: stableKeySchema.optional(),
  })
  .strict();
export type PackTile = z.infer<typeof packTileSchema>;

/** One entry of `sentences.yaml` (DR-11, DR-12, DR-13). */
export const packSentenceSchema = z
  .object({
    text: nonEmptyTextSchema,
    translation: nonEmptyTextSchema,
    tiles: z.array(packTileSchema),
    reviewStatus: reviewStatusSchema.default('unreviewed'),
    grammar: z.array(stableKeySchema).default([]),
    vocabLevel: levelCodeSchema.nullable().default(null),
    grammarLevel: levelCodeSchema.nullable().default(null),
    challengeOverride: z.boolean().nullable().default(null),
    source: nonEmptyTextSchema.nullable().default(null),
    sourceId: nonEmptyTextSchema.nullable().default(null),
    attribution: sentenceAttributionSchema.nullable().default(null),
    edited: z.boolean().default(false),
    translationEdited: z.boolean().default(false),
    tokensEdited: z.boolean().default(false),
  })
  .strict()
  .refine((s) => (s.source === null) === (s.sourceId === null), {
    message: 'source and sourceId are set together',
    path: ['sourceId'],
  })
  .refine((s) => s.source === null || s.attribution !== null, {
    message: 'An imported sentence needs attribution',
    path: ['attribution'],
  });
export type PackSentence = z.infer<typeof packSentenceSchema>;
export const packSentencesFileSchema = z.array(packSentenceSchema);

/** FR-237: `lists/blocked-words.yaml`, the blocklist of the course's target language. */
export const packBlockedWordsFileSchema = z.array(nonEmptyTextSchema);
/**
 * One entry of `lists/supplementary-words.yaml` (FR-234): a common word the level lists lack,
 * treated as a level-list word at `level`. A kana-only word has its reading as `written`.
 */
export const packSupplementaryWordSchema = z
  .object({
    level: levelCodeSchema,
    written: nonEmptyTextSchema,
    reading: nonEmptyTextSchema,
    note: nonEmptyTextSchema.optional(),
  })
  .strict();
export type PackSupplementaryWord = z.infer<typeof packSupplementaryWordSchema>;
export const packSupplementaryWordsFileSchema = z.array(packSupplementaryWordSchema);

/** A whole pack in memory, as read from (or written to) a pack directory. */
export interface ContentPack {
  course: PackCourse;
  /** In path order. */
  units: PackUnit[];
  /** Entries of items/*.yaml plus the grammar points, each as an authored item. */
  items: (PackItem & { related?: string[] })[];
  sentences: PackSentence[];
  /** FR-237: `lists/blocked-words.yaml`; empty when the file is missing. */
  blockedWords: string[];
  supplementaryWords: PackSupplementaryWord[];
}

/** A pack that cannot be read or imported. Each problem names its file or key, and a path. */
export class ContentPackError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'));
    this.name = 'ContentPackError';
  }
}

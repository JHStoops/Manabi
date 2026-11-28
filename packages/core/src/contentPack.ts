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

/**
 * An authored exercise in a unit file (DR-12, FR-238). `key` is unique within its lesson.
 * `payload` is the exercise type's payload with each item named by key (`item: <key>`) where the
 * stored payload has `itemId`; answer text may leave out its `tiles`, which import segments.
 * The type's payload schema validates it once keys and tiles are filled in.
 */
export const packExerciseSchema = z
  .object({ key: stableKeySchema, type: typeIdSchema, payload: jsonObjectSchema })
  .strict();
export type PackExercise = z.infer<typeof packExerciseSchema>;

/**
 * One lesson inside a unit file. `items` are the keys of the new items it teaches, in order;
 * `exercises` its authored exercises, in order.
 */
export const packLessonSchema = z
  .object({
    key: stableKeySchema,
    type: lessonTypeSchema,
    title: nonEmptyTextSchema,
    status: publishStatusSchema.default('draft'),
    items: z.array(stableKeySchema).default([]),
    exercises: z.array(packExerciseSchema).default([]),
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
    /** Part of the highlighted grammar pattern (see `tileSchema`). */
    pattern: z.literal(true).optional(),
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

/**
 * #128, SDD section 4 (`audio/`): one entry of `audio/clips.yaml`, a recorded clip in `audio/` and
 * its owner. An item is named by its stable key; a sentence, which has no key, as the import
 * matches it: an imported one by source and source id, an authored one by its text.
 */
export const packAudioClipSchema = z
  .object({
    /** A plain file name inside `audio/`: no folders, so it can never point outside the pack. */
    file: z
      .string()
      .max(200)
      .regex(
        /^[\p{L}\p{N}][\p{L}\p{N}._-]*\.(opus|ogg|oga|mp3|wav|webm|m4a|flac)$/u,
        'a file name in audio/ ending in .opus, .ogg, .oga, .mp3, .wav, .webm, .m4a or .flac',
      ),
    item: stableKeySchema.optional(),
    sentence: z
      .union([
        z.object({ source: nonEmptyTextSchema, sourceId: nonEmptyTextSchema }).strict(),
        z.object({ text: nonEmptyTextSchema }).strict(),
      ])
      .optional(),
  })
  .strict()
  .refine((c) => (c.item === undefined) !== (c.sentence === undefined), {
    message: 'name either an item or a sentence',
    path: ['item'],
  });
export type PackAudioClipEntry = z.infer<typeof packAudioClipSchema>;
export const packAudioClipsFileSchema = z.array(packAudioClipSchema);

/** A clip of a pack with its file's bytes. */
export type PackAudioClip = PackAudioClipEntry & { data: Uint8Array };

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
  /** #128: recorded clips from `audio/`, which replace generated ones; none when absent. */
  audio?: PackAudioClip[];
}

/** A pack that cannot be read or imported. Each problem names its file or key, and a path. */
export class ContentPackError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('\n'));
    this.name = 'ContentPackError';
  }
}

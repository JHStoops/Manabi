/**
 * Row types for the content tables (migration 0001, SDD section 5). One interface per table,
 * matching the column names and the types pg returns (int8 as number, timestamptz as Date,
 * jsonb parsed). JSONB shapes are validated by Zod schemas in @manabi/core and the language
 * plugin on write (DR-06), so here they are typed loosely.
 */

import type {
  ExerciseOrigin,
  ItemLinkKind,
  LessonType,
  PublishStatus,
  ReviewStatus,
  SentenceAttribution,
  Tile,
} from '@manabi/core';

export type AudioOwnerType = 'item' | 'sentence';
export type AudioOrigin = 'generated' | 'uploaded';

export type JsonObject = { [key: string]: unknown };

export interface CourseRow {
  id: number;
  key: string;
  target_lang: string;
  base_lang: string;
  plugin: string;
  title: string;
  status: PublishStatus;
  created_at: Date;
  updated_at: Date;
}

export interface SectionRow {
  id: number;
  course_id: number;
  key: string;
  position: number;
  title: string;
  level_code: string;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UnitRow {
  id: number;
  section_id: number;
  key: string;
  position: number;
  title: string;
  status: PublishStatus;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface LessonRow {
  id: number;
  unit_id: number;
  key: string;
  position: number;
  type: LessonType;
  title: string;
  status: PublishStatus;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** DR-09: `data`, `source` and `dataset_version` are imported; `overrides` are author edits. */
export interface ItemRow {
  id: number;
  course_id: number;
  key: string;
  type: string;
  level_code: string | null;
  data: JsonObject;
  overrides: JsonObject;
  source: string | null;
  dataset_version: string | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ItemLinkRow {
  from_item_id: number;
  to_item_id: number;
  kind: ItemLinkKind;
}

export interface LessonItemRow {
  lesson_id: number;
  item_id: number;
  position: number;
}

export interface SentenceRow {
  id: number;
  course_id: number;
  text: string;
  /** DR-12 tiles. */
  tokens: Tile[];
  translation: string;
  source: string | null;
  source_id: string | null;
  attribution: SentenceAttribution | null;
  review_status: ReviewStatus;
  /** Keys of grammar points detected at import. */
  grammar: string[];
  /** Highest level among levelled content words (FR-235); null when there are none. */
  vocab_level_code: string | null;
  /** Highest level among the detected grammar points; null when none were detected. */
  grammar_level_code: string | null;
  /** Null: "challenging" is derived from the levels; otherwise the author's decision. */
  challenge_override: boolean | null;
  edited: boolean;
  translation_edited: boolean;
  tokens_edited: boolean;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SentenceItemRow {
  sentence_id: number;
  item_id: number;
}

export interface SupplementaryWordRow {
  id: number;
  course_id: number;
  level_code: string;
  written: string;
  reading: string;
  note: string | null;
  created_at: Date;
}

export interface BlockedWordRow {
  id: number;
  lang: string;
  word: string;
  created_at: Date;
}

export interface ExerciseRow {
  id: number;
  lesson_id: number | null;
  item_id: number | null;
  type: string;
  payload: JsonObject;
  origin: ExerciseOrigin;
  created_at: Date;
  updated_at: Date;
}

export interface AudioAssetRow {
  id: number;
  owner_type: AudioOwnerType;
  owner_id: number;
  /** Null only for uploaded recordings. */
  voice: string | null;
  path: string;
  origin: AudioOrigin;
  text_hash: string;
  created_at: Date;
}

export interface StrokeDataRow {
  item_id: number;
  strokes: JsonObject;
  updated_at: Date;
}

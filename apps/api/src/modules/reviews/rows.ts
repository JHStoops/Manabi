/**
 * Row types for review progress, the review log and notes (migration 0003, SDD section 5).
 * int8 comes back as number, timestamptz as Date.
 */

/** Stages 1 to 7 are on the ladder; 8 is Retired and never due (Product Spec section 7). */
export type Stage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** One row per item and review facet (FR-110). Facets come from the language plugin. */
export interface ItemProgressRow {
  user_id: number;
  item_id: number;
  facet: string;
  stage: Stage;
  /** Null exactly when the item is retired (stage 8). */
  due_at: Date | null;
  last_reviewed_at: Date | null;
  correct_count: number;
  wrong_count: number;
  created_at: Date;
}

/** FR-117, DR-04: append-only. */
export interface ReviewLogRow {
  id: number;
  user_id: number;
  item_id: number;
  facet: string;
  exercise_type: string;
  correct: boolean;
  stage_before: Stage;
  stage_after: Stage;
  answered_at: Date;
}

export interface UserNoteRow {
  user_id: number;
  item_id: number;
  body: string;
  created_at: Date;
  updated_at: Date;
}

/** FR-114: resumable until expires_at. `state` is validated by Zod in @manabi/core. */
export interface ReviewSessionRow {
  id: number;
  user_id: number;
  state: { [key: string]: unknown };
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

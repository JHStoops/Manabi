/**
 * Row types for lesson progress and lesson sessions (migration 0003, SDD section 5).
 * int8 comes back as number, timestamptz as Date, jsonb parsed.
 */

/** A row exists once the lesson has been completed at least once (FR-020, FR-021). */
export interface LessonProgressRow {
  user_id: number;
  lesson_id: number;
  completed_at: Date;
  /** Whole percentage, 0 to 100. */
  best_accuracy: number;
  times_completed: number;
}

/** FR-050: resumable until expires_at. `state` is validated by Zod in @manabi/core. */
export interface LessonSessionRow {
  id: number;
  user_id: number;
  lesson_id: number;
  state: { [key: string]: unknown };
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

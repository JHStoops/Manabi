/**
 * Row types for answer reports and import runs (migration 0004, SDD section 5).
 * int8 comes back as number, timestamptz as Date, jsonb parsed.
 */

export type AnswerReportStatus = 'open' | 'accepted' | 'dismissed';
export type ImportRunStatus = 'running' | 'succeeded' | 'failed';

/** FR-054, FR-229. user_id is null once the reporter's account is deleted (DR-07). */
export interface AnswerReportRow {
  id: number;
  user_id: number | null;
  /** Null for session-generated exercises; set when accepting pins one (FR-229). */
  exercise_id: number | null;
  item_id: number | null;
  exercise_type: string;
  /** The exercise as the learner saw it. */
  exercise_payload: { [key: string]: unknown };
  given_answer: string;
  status: AnswerReportStatus;
  resolved_by: number | null;
  resolved_at: Date | null;
  created_at: Date;
}

/** FR-226: one row per dataset import run. */
export interface ImportRunRow {
  id: number;
  importer: string;
  started_at: Date;
  finished_at: Date | null;
  status: ImportRunStatus;
  summary: { [key: string]: unknown };
}

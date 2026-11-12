/**
 * Row types for enrollments and the XP, streak and booster tables (migration 0003, SDD sections
 * 5 and 7). int8 comes back as number, timestamptz as Date, date as a 'YYYY-MM-DD' string
 * (see db/pool.ts), and numeric as a string such as '1.50', so multipliers are strings.
 */

/** FR-162: XP total and level per course, a cache of xp_events (DR-04). */
export interface EnrollmentRow {
  user_id: number;
  course_id: number;
  started_at: Date;
  total_xp: number;
  level: number;
}

/** DR-04, FR-170: append-only ledger row. */
export interface XpEventRow {
  id: number;
  user_id: number;
  course_id: number;
  base_amount: number;
  /** numeric(4,2) as a string, for example '1.50'. */
  multiplier: string;
  amount: number;
  reason: string;
  ref_id: number | null;
  earned_at: Date;
  /** DR-05: the learner's calendar date when earned, 'YYYY-MM-DD'. */
  local_date: string;
}

/** FR-163, FR-164: streak cache across courses, rebuildable from xp_events. */
export interface UserStatsRow {
  user_id: number;
  current_streak: number;
  longest_streak: number;
  freezes: number;
  /** 'YYYY-MM-DD' in the learner's time zone. */
  last_active_date: string | null;
  updated_at: Date;
}

/** FR-169: active while started_at <= now() < ends_at. */
export interface BoosterRow {
  id: number;
  user_id: number;
  /** numeric(4,2) as a string, for example '2.00'. */
  multiplier: string;
  reason: string;
  started_at: Date;
  ends_at: Date;
}

/**
 * Row types for the social tables and achievements (migration 0004, SDD section 5).
 * int8 comes back as number, timestamptz as Date, date as a 'YYYY-MM-DD' string (db/pool.ts).
 */

export type NudgeKind = 'nice_work' | 'keep_going';

export interface FollowRow {
  follower_id: number;
  followee_id: number;
  created_at: Date;
}

/** FR-183: one per sender, recipient and the sender's local date. */
export interface NudgeRow {
  id: number;
  from_user_id: number;
  to_user_id: number;
  kind: NudgeKind;
  sent_at: Date;
  local_date: string;
  seen_at: Date | null;
}

/** FR-181: written at the weekly rollover. */
export interface WeeklyResultRow {
  /** The Monday that starts the week, 'YYYY-MM-DD'. */
  week_start: string;
  user_id: number;
  xp: number;
  rank: number;
  created_at: Date;
}

/** FR-165: seeded definitions; group_key is the SDD's `group`. */
export interface AchievementRow {
  key: string;
  group_key: string;
  metric: string;
  threshold: number;
  title: string;
  created_at: Date;
}

export interface UserAchievementRow {
  user_id: number;
  achievement_key: string;
  earned_at: Date;
  seen_at: Date | null;
}

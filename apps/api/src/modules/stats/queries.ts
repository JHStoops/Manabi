import type { Queryable } from '../../db/db';
import { query, queryOne } from '../../db/db';

// Hand-written, parameterized SQL for the streak cache (user_stats) and the daily goal (FR-161,
// FR-163, FR-164). user_stats is a cache; xp_events stays the source of truth.

export interface StatsRow {
  current_streak: number;
  longest_streak: number;
  freezes: number;
  last_active_date: string | null;
}

/** Creates the learner's user_stats row if missing, then locks it, so streak updates are serial. */
export async function lockStats(db: Queryable, userId: number): Promise<StatsRow> {
  await query(db, `INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
  const row = await queryOne<StatsRow>(
    db,
    `SELECT current_streak, longest_streak, freezes, last_active_date
       FROM user_stats WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  return row!;
}

export async function saveStats(db: Queryable, userId: number, s: StatsRow) {
  await query(
    db,
    `UPDATE user_stats
        SET current_streak = $2, longest_streak = $3, freezes = $4, last_active_date = $5,
            updated_at = now()
      WHERE user_id = $1`,
    [userId, s.current_streak, s.longest_streak, s.freezes, s.last_active_date],
  );
}

/** FR-163: the learner's XP on one local date, across all courses. */
export async function sumXpOnDate(db: Queryable, userId: number, localDate: string) {
  const row = await queryOne<{ xp: number }>(
    db,
    `SELECT COALESCE(sum(amount), 0)::int AS xp FROM xp_events
      WHERE user_id = $1 AND local_date = $2`,
    [userId, localDate],
  );
  return row!.xp;
}

/** FR-164: learners whose streak is running but whose last counted day is before their yesterday. */
export function listStreaksToSettle(
  db: Queryable,
): Promise<{ user_id: number; yesterday: string }[]> {
  return query(
    db,
    `SELECT s.user_id, ((now() AT TIME ZONE u.time_zone)::date - 1)::text AS yesterday
       FROM user_stats s
       JOIN users u ON u.id = s.user_id
      WHERE s.current_streak > 0
        AND s.last_active_date < (now() AT TIME ZONE u.time_zone)::date - 1`,
  );
}

export interface UserStatsRow extends StatsRow {
  settings: unknown;
  today_xp: number;
}

/** GET /me/stats: the cached streak, the daily-goal setting and today's XP in the learner's zone. */
export function findUserStats(db: Queryable, userId: number): Promise<UserStatsRow | null> {
  return queryOne(
    db,
    `SELECT COALESCE(s.current_streak, 0) AS current_streak,
            COALESCE(s.longest_streak, 0) AS longest_streak,
            COALESCE(s.freezes, 0) AS freezes,
            s.last_active_date,
            u.settings,
            (SELECT COALESCE(sum(x.amount), 0)::int FROM xp_events x
              WHERE x.user_id = u.id
                AND x.local_date = (now() AT TIME ZONE u.time_zone)::date) AS today_xp
       FROM users u
       LEFT JOIN user_stats s ON s.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );
}

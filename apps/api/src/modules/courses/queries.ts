import type { LessonType, PublishStatus } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { insertReturning, query, queryOne } from '../../db/db';
import type { CourseRow } from '../content/rows';
import type { XpEventRow } from './rows';

// Hand-written, parameterized SQL for courses, enrollments, the path and the XP ledger. The ledger
// is append-only (DR-04): there are no UPDATE or DELETE statements against xp_events, and the
// database rejects them.

/** FR-023: published courses (and drafts when `includeDrafts`) with whether the user is enrolled. */
export function listCourses(
  db: Queryable,
  userId: number,
  includeDrafts: boolean,
): Promise<(CourseRow & { enrolled: boolean })[]> {
  return query(
    db,
    `SELECT c.*, e.user_id IS NOT NULL AS enrolled
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = $1
      WHERE c.status = 'published' OR $2
      ORDER BY c.title, c.id`,
    [userId, includeDrafts],
  );
}

export function findCourse(db: Queryable, id: number): Promise<CourseRow | null> {
  return queryOne<CourseRow>(db, `SELECT * FROM courses WHERE id = $1`, [id]);
}

/** FR-023: enrolling twice keeps the first enrollment (and its XP). */
export async function insertEnrollment(db: Queryable, userId: number, courseId: number) {
  await query(
    db,
    `INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, courseId],
  );
}

/** FR-023: the active course lives in the user's settings (learnerSettingsSchema). */
export async function setActiveCourse(db: Queryable, userId: number, courseId: number) {
  await query(
    db,
    `UPDATE users SET settings = settings || jsonb_build_object('activeCourseId', $2::bigint),
            updated_at = now()
      WHERE id = $1`,
    [userId, courseId],
  );
}

/**
 * FR-021, FR-232: records that the user finished a unit (its last visible lesson completed, or a
 * passed test-out). Insert-only; a second call keeps the first completion. Called inside the
 * lesson-completion (#37) and test-out (#96) transactions.
 */
export async function insertUnitCompletion(db: Queryable, userId: number, unitId: number) {
  await query(
    db,
    `INSERT INTO unit_completions (user_id, unit_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, unitId],
  );
}

/** One lesson on the path with its unit and section, and whether the user completed them. */
export interface PathRow {
  section_id: number;
  section_key: string;
  section_title: string;
  level_code: string;
  unit_id: number;
  unit_key: string;
  unit_title: string;
  unit_status: PublishStatus;
  lesson_id: number;
  lesson_key: string;
  lesson_type: LessonType;
  lesson_title: string;
  lesson_status: PublishStatus;
  completed: boolean;
  unit_completed: boolean;
}

/**
 * FR-020, FR-022: the course's active (not archived) lessons in path order with the user's
 * completions. Learners get published units and lessons only; `includeDrafts` is the admin
 * preview. Units without a visible lesson are left out.
 */
export function listPathRows(
  db: Queryable,
  courseId: number,
  userId: number,
  includeDrafts: boolean,
): Promise<PathRow[]> {
  return query<PathRow>(
    db,
    `SELECT s.id AS section_id, s.key AS section_key, s.title AS section_title, s.level_code,
            u.id AS unit_id, u.key AS unit_key, u.title AS unit_title, u.status AS unit_status,
            l.id AS lesson_id, l.key AS lesson_key, l.type AS lesson_type,
            l.title AS lesson_title, l.status AS lesson_status,
            p.user_id IS NOT NULL AS completed, uc.user_id IS NOT NULL AS unit_completed
       FROM sections s
       JOIN units u ON u.section_id = s.id AND u.archived_at IS NULL
       JOIN lessons l ON l.unit_id = u.id AND l.archived_at IS NULL
       LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = $2
       LEFT JOIN unit_completions uc ON uc.unit_id = u.id AND uc.user_id = $2
      WHERE s.course_id = $1 AND s.archived_at IS NULL
        AND ($3 OR (u.status = 'published' AND l.status = 'published'))
      ORDER BY s.position, u.position, l.position`,
    [courseId, userId, includeDrafts],
  );
}

export interface NewXpEvent {
  userId: number;
  courseId: number;
  baseAmount: number;
  multiplier: number;
  amount: number;
  reason: string;
  refId: number | null;
  earnedAt: Date;
  /** DR-05: the learner's calendar date at earnedAt, 'YYYY-MM-DD'. */
  localDate: string;
}

export function insertXpEvent(db: Queryable, e: NewXpEvent): Promise<XpEventRow> {
  return insertReturning<XpEventRow>(
    db,
    `INSERT INTO xp_events
       (user_id, course_id, base_amount, multiplier, amount, reason, ref_id, earned_at, local_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      e.userId,
      e.courseId,
      e.baseAmount,
      e.multiplier,
      e.amount,
      e.reason,
      e.refId,
      e.earnedAt,
      e.localDate,
    ],
  );
}

/**
 * FR-162, DR-05: locks the learner's enrollment for an award and returns its total with the
 * learner's local calendar date at `at`, from users.time_zone. Null when not enrolled. The row
 * lock comes before the ledger insert, so rebuildXpTotals (which locks the table) sees whole awards.
 */
export function lockEnrollmentForAward(
  db: Queryable,
  userId: number,
  courseId: number,
  at: Date,
): Promise<{ total_xp: number; local_date: string } | null> {
  return queryOne(
    db,
    `SELECT e.total_xp, ($3::timestamptz AT TIME ZONE u.time_zone)::date AS local_date
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
      WHERE e.user_id = $1 AND e.course_id = $2
        FOR UPDATE OF e`,
    [userId, courseId, at],
  );
}

/** FR-162: the cached total and level, which only the award and rebuild paths write. */
export async function setEnrollmentXp(
  db: Queryable,
  userId: number,
  courseId: number,
  totalXp: number,
  level: number,
) {
  await query(
    db,
    `UPDATE enrollments SET total_xp = $3, level = $4 WHERE user_id = $1 AND course_id = $2`,
    [userId, courseId, totalXp, level],
  );
}

/** FR-055: whether the learner has already been awarded `reason` for `refId` in the course. */
export async function hasXpEvent(
  db: Queryable,
  userId: number,
  courseId: number,
  reason: string,
  refId: number,
): Promise<boolean> {
  const row = await queryOne<{ found: boolean }>(
    db,
    `SELECT EXISTS (
       SELECT 1 FROM xp_events
        WHERE user_id = $1 AND course_id = $2 AND reason = $3 AND ref_id = $4
     ) AS found`,
    [userId, courseId, reason, refId],
  );
  return row!.found;
}

/** The course a lesson belongs to, or null for an unknown lesson. */
export async function findLessonCourseId(db: Queryable, lessonId: number): Promise<number | null> {
  const row = await queryOne<{ course_id: number }>(
    db,
    `SELECT s.course_id
       FROM lessons l
       JOIN units u ON u.id = l.unit_id
       JOIN sections s ON s.id = u.section_id
      WHERE l.id = $1`,
    [lessonId],
  );
  return row?.course_id ?? null;
}

/**
 * DR-04: blocks awards (they lock an enrollment row first) for the rest of the transaction, so
 * the ledger sums read next stay current until the rebuilt totals are written.
 */
export async function lockEnrollments(db: Queryable) {
  await query(db, `LOCK TABLE enrollments IN EXCLUSIVE MODE`);
}

/** DR-04: every enrollment with its XP summed from the ledger. */
export function sumXpByEnrollment(
  db: Queryable,
): Promise<{ user_id: number; course_id: number; total_xp: number }[]> {
  return query(
    db,
    `SELECT e.user_id, e.course_id, COALESCE(sum(x.amount), 0)::int AS total_xp
       FROM enrollments e
       LEFT JOIN xp_events x ON x.user_id = e.user_id AND x.course_id = e.course_id
      GROUP BY e.user_id, e.course_id
      ORDER BY e.user_id, e.course_id`,
  );
}

import type { LessonType, PublishStatus } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { insertReturning, query, queryOne } from '../../db/db';
import type { CourseRow } from '../content/rows';
import type { XpEventRow } from './rows';

// Hand-written, parameterized SQL for courses, enrollments, the path and the XP ledger. The ledger
// is append-only (DR-04): there are no UPDATE or DELETE statements against xp_events, and the
// database rejects them. Award, streak and rebuild queries are added by the issues that need them.

/** FR-023: published courses with whether the user is enrolled. */
export function listPublishedCourses(
  db: Queryable,
  userId: number,
): Promise<(CourseRow & { enrolled: boolean })[]> {
  return query(
    db,
    `SELECT c.*, e.user_id IS NOT NULL AS enrolled
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = $1
      WHERE c.status = 'published'
      ORDER BY c.title, c.id`,
    [userId],
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

/** One lesson on the path with its unit and section, and the user's first completion. */
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
  lesson_created_at: Date;
  completed_at: Date | null;
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
            l.created_at AS lesson_created_at, p.completed_at
       FROM sections s
       JOIN units u ON u.section_id = s.id AND u.archived_at IS NULL
       JOIN lessons l ON l.unit_id = u.id AND l.archived_at IS NULL
       LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = $2
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

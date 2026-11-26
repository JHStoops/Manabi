import type { Pool } from 'pg';
import {
  XP_RULES,
  learnerSettingsSchema,
  lessonStates,
  lessonXpReasons,
  levelForXp,
} from '@manabi/core';
import type { Course, CourseList, CourseListEntry, CoursePath, XpReason } from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import type { CourseRow } from '../content/rows';
import type { AuthContext, ScopedUserId } from '../auth/service';
import { recordXpForStreak } from '../stats/service';
import * as q from './queries';

// Courses, enrollment and the learning path (FR-020 to FR-023). Every query is scoped to the
// caller's own user id, so a learner only ever sees their own progress (NFR-14).

function toCourse(row: CourseRow): Course {
  return {
    id: row.id,
    key: row.key,
    targetLang: row.target_lang,
    baseLang: row.base_lang,
    plugin: row.plugin,
    title: row.title,
    status: row.status,
  };
}

/** FR-023: published courses (admins also see drafts, marked by status), marking the caller's enrollments and active course. */
export async function listCourses(db: Pool, auth: AuthContext): Promise<CourseList> {
  const { activeCourseId } = learnerSettingsSchema.parse(auth.user.settings);
  const rows = await q.listCourses(db, auth.userId, auth.user.role === 'admin');
  return {
    courses: rows.map((row) => ({
      ...toCourse(row),
      enrolled: row.enrolled,
      active: row.id === activeCourseId,
    })),
  };
}

/** FR-023: enrolls the caller (once) and makes the course their active one. */
export async function enroll(
  db: Pool,
  userId: ScopedUserId,
  courseId: number,
): Promise<CourseListEntry> {
  const course = await q.findCourse(db, courseId);
  if (!course || course.status !== 'published') {
    throw new AppError('not_found', 'Course not found');
  }
  await withTransaction(db, async (client) => {
    await q.insertEnrollment(client, userId, courseId);
    await q.setActiveCourse(client, userId, courseId);
  });
  return { ...toCourse(course), enrolled: true, active: true };
}

/** FR-020 to FR-022: the course path with the caller's lesson states. */
export async function getPath(
  db: Queryable,
  userId: ScopedUserId,
  courseId: number,
  preview: boolean,
): Promise<CoursePath> {
  const course = await q.findCourse(db, courseId);
  if (!course || (course.status !== 'published' && !preview)) {
    throw new AppError('not_found', 'Course not found');
  }
  const rows = await q.listPathRows(db, courseId, userId, preview);

  const units: q.PathRow[][] = [];
  for (const row of rows) {
    const unit = units.at(-1);
    if (unit?.[0]!.unit_id === row.unit_id) unit.push(row);
    else units.push([row]);
  }
  const states = lessonStates(
    units.map((lessons) => ({
      testedOut: lessons[0]!.unit_tested_out,
      completed: lessons[0]!.unit_completed,
      lessons: lessons.map((l) => ({ completed: l.completed })),
    })),
  );

  const sections: CoursePath['sections'] = [];
  units.forEach((lessons, k) => {
    const first = lessons[0]!;
    if (sections.at(-1)?.id !== first.section_id) {
      sections.push({
        id: first.section_id,
        key: first.section_key,
        title: first.section_title,
        levelCode: first.level_code,
        units: [],
      });
    }
    sections.at(-1)!.units.push({
      id: first.unit_id,
      key: first.unit_key,
      title: first.unit_title,
      status: first.unit_status,
      // FR-024: open (its first lesson is not locked), not finished, and a lesson still to do.
      testOutAvailable:
        !first.unit_completed &&
        states[k]![0] !== 'locked' &&
        states[k]!.some((state) => state !== 'completed'),
      lessons: lessons.map((l, i) => ({
        id: l.lesson_id,
        key: l.lesson_key,
        type: l.lesson_type,
        title: l.lesson_title,
        status: l.lesson_status,
        state: states[k]![i]!,
      })),
    });
  });
  return { course: toCourse(course), sections };
}

/** The learner's course XP after an award (FR-162), for the results screen. */
export interface XpAward {
  /** XP earned by this award (or these awards). */
  xpEarned: number;
  totalXp: number;
  level: number;
}

/**
 * FR-160, FR-162, DR-05: appends one award to the ledger and updates the enrollment's cached total
 * and level. Runs inside the caller's progress transaction (`db` is its client), so the award
 * commits or rolls back with the rest. The learner must be enrolled in the course.
 */
export async function awardXp(
  db: Queryable,
  award: { userId: number; courseId: number; reason: XpReason; refId: number | null; at?: Date },
): Promise<XpAward> {
  const { userId, courseId, reason, refId } = award;
  const at = award.at ?? new Date();
  const enrollment = await q.lockEnrollmentForAward(db, userId, courseId, at);
  if (!enrollment) throw new AppError('conflict', 'Not enrolled in this course');
  const baseAmount = XP_RULES[reason];
  // shortcut: multiplier is always 1 until boosters (FR-169, FR-170) read the active one here.
  const multiplier = 1;
  const amount = baseAmount;
  await q.insertXpEvent(db, {
    userId,
    courseId,
    baseAmount,
    multiplier,
    amount,
    reason,
    refId,
    earnedAt: at,
    localDate: enrollment.local_date,
  });
  // FR-163, FR-164: the day may now count toward the learner's streak.
  await recordXpForStreak(db, userId, enrollment.local_date);
  const totalXp = enrollment.total_xp + amount;
  const level = levelForXp(totalXp);
  await q.setEnrollmentXp(db, userId, courseId, totalXp, level);
  return { xpEarned: amount, totalXp, level };
}

/**
 * FR-055, FR-160: XP for completing a lesson. The first completion earns new-lesson XP (plus the
 * accuracy bonus at 90% or better before the retry round); every later one earns replay XP.
 * Which one is decided from the ledger, so it does not depend on when the caller writes
 * lesson_progress. Called inside the lesson-completion transaction (#37). `accuracy` is a whole
 * percentage, 0 to 100 (not a fraction), measured before the retry round.
 */
export async function awardLessonXp(
  db: Queryable,
  userId: number,
  lessonId: number,
  accuracy: number,
  at?: Date,
): Promise<XpAward> {
  const courseId = await q.findLessonCourseId(db, lessonId);
  if (courseId === null) throw new AppError('not_found', 'Lesson not found');
  // Lock the enrollment before reading the ledger, so two concurrent completions of the same
  // lesson cannot both see no lesson_new event; awardXp re-locks the row, which is a no-op.
  if (!(await q.lockEnrollmentForAward(db, userId, courseId, at ?? new Date()))) {
    throw new AppError('conflict', 'Not enrolled in this course');
  }
  const first = !(await q.hasXpEvent(db, userId, courseId, 'lesson_new', lessonId));
  let result: XpAward | undefined;
  let xpEarned = 0;
  for (const reason of lessonXpReasons(first, accuracy)) {
    result = await awardXp(db, { userId, courseId, reason, refId: lessonId, at });
    xpEarned += result.xpEarned;
  }
  return { ...result!, xpEarned };
}

/**
 * FR-024, FR-021: the XP side of a finished test-out, inside its transaction. A pass records the
 * unit as finished by test-out and awards test-out XP; a unit already finished (by its lessons or
 * an earlier pass) gets neither, and a fail changes nothing. Returns the course XP either way.
 */
export async function recordTestOut(
  db: Queryable,
  award: { userId: number; courseId: number; unitId: number; passed: boolean },
): Promise<XpAward> {
  const { userId, courseId, unitId, passed } = award;
  const at = new Date();
  const enrollment = await q.lockEnrollmentForAward(db, userId, courseId, at);
  if (!enrollment) throw new AppError('conflict', 'Not enrolled in this course');
  // The completion row is the once-only guard: a concurrent second pass waits on it, then skips.
  if (passed && (await q.insertUnitCompletion(db, userId, unitId, true))) {
    return awardXp(db, { userId, courseId, reason: 'test_out', refId: unitId, at });
  }
  return { xpEarned: 0, totalXp: enrollment.total_xp, level: levelForXp(enrollment.total_xp) };
}

/**
 * DR-04: recomputes every enrollment's total_xp and level from the ledger (`manabi rebuild-xp`).
 * Returns how many enrollments were rebuilt.
 */
export function rebuildXpTotals(db: Pool): Promise<number> {
  return withTransaction(db, async (client) => {
    await q.lockEnrollments(client);
    const rows = await q.sumXpByEnrollment(client);
    for (const row of rows) {
      await q.setEnrollmentXp(
        client,
        row.user_id,
        row.course_id,
        row.total_xp,
        levelForXp(row.total_xp),
      );
    }
    return rows.length;
  });
}

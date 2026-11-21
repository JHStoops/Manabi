import type { Pool } from 'pg';
import { learnerSettingsSchema, lessonStates } from '@manabi/core';
import type { Course, CourseList, CourseListEntry, CoursePath } from '@manabi/core';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import type { CourseRow } from '../content/rows';
import type { AuthContext, ScopedUserId } from '../auth/service';
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

/** FR-023: published courses, marking the caller's enrollments and active course. */
export async function listCourses(db: Pool, auth: AuthContext): Promise<CourseList> {
  const { activeCourseId } = learnerSettingsSchema.parse(auth.user.settings);
  const rows = await q.listPublishedCourses(db, auth.userId);
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
  db: Pool,
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
  // shortcut: no unit is ever tested out, since test-out results are not stored yet; pass them in
  // when FR-024 (test-out, #96) adds their storage.
  const states = lessonStates(
    units.map((lessons) => ({
      testedOut: false,
      lessons: lessons.map((l) => ({ completedAt: l.completed_at, addedAt: l.lesson_created_at })),
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

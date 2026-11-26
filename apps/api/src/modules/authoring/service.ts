import type { Pool, PoolClient } from 'pg';
import type {
  CourseTree,
  CreateLessonRequest,
  CreateSectionRequest,
  CreateUnitRequest,
  UpdateLessonRequest,
  UpdateSectionRequest,
  UpdateUnitRequest,
} from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import { deferPositionChecks, listActiveSections, listActiveUnits } from '../content/queries';
import { findCourse } from '../courses/queries';
import * as q from './queries';

// The course tree editor (FR-220, FR-225, Product Spec section 11). Every change returns the
// course's tree. Nothing here writes to a progress table, so publishing, reordering or deleting
// never changes a learner's progress; content with progress is archived instead of deleted.

/** FR-220: the course's active sections, units and lessons in order, drafts included. */
export async function getTree(db: Queryable, courseId: number): Promise<CourseTree> {
  const course = await findCourse(db, courseId);
  if (!course) throw new AppError('not_found', 'Course not found');
  const sections = await listActiveSections(db, courseId);
  const units = await listActiveUnits(db, courseId);
  const lessons = await q.listTreeLessons(db, courseId);
  return {
    course: {
      id: course.id,
      key: course.key,
      targetLang: course.target_lang,
      baseLang: course.base_lang,
      plugin: course.plugin,
      title: course.title,
      status: course.status,
    },
    sections: sections.map((s) => ({
      id: s.id,
      courseId: s.course_id,
      key: s.key,
      position: s.position,
      title: s.title,
      levelCode: s.level_code,
      units: units
        .filter((u) => u.section_id === s.id)
        .map((u) => ({
          id: u.id,
          sectionId: u.section_id,
          key: u.key,
          position: u.position,
          title: u.title,
          status: u.status,
          lessons: lessons
            .filter((l) => l.unit_id === u.id)
            .map((l) => ({
              id: l.id,
              unitId: l.unit_id,
              key: l.key,
              position: l.position,
              type: l.type,
              title: l.title,
              status: l.status,
            })),
        })),
    })),
  };
}

/** Runs a tree change in one transaction and returns the course's tree afterwards. */
async function change(pool: Pool, fn: (db: PoolClient) => Promise<number>): Promise<CourseTree> {
  try {
    const courseId = await withTransaction(pool, fn);
    return await getTree(pool, courseId);
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      throw new AppError('conflict', 'That key is already used', { field: 'slug' });
    }
    throw err;
  }
}

/** Moves `id` to index `position` among its active siblings; archived ones stay after them. */
async function move(
  db: Queryable,
  siblings: { id: number; archived: boolean }[],
  id: number,
  position: number,
  save: (db: Queryable, ids: number[]) => Promise<void>,
): Promise<void> {
  const active = siblings.filter((s) => !s.archived && s.id !== id).map((s) => s.id);
  active.splice(Math.min(position, active.length), 0, id);
  await deferPositionChecks(db);
  await save(db, [...active, ...siblings.filter((s) => s.archived).map((s) => s.id)]);
}

/**
 * FR-225: deletes the row, or archives it when progress refers to it (a completed lesson, an open
 * lesson session, a unit completion or an answer report: foreign keys with ON DELETE RESTRICT).
 */
export async function deleteOrArchive(
  db: Queryable,
  remove: () => Promise<void>,
  archive: () => Promise<void>,
): Promise<void> {
  await q.savepoint(db);
  try {
    await remove();
  } catch (err) {
    if ((err as { code?: string }).code !== '23503') throw err;
    await q.rollbackToSavepoint(db);
    await archive();
  }
}

function notFound(what: string): never {
  throw new AppError('not_found', `${what} not found`);
}

export function createSection(pool: Pool, courseId: number, body: CreateSectionRequest) {
  return change(pool, async (db) => {
    const course = (await findCourse(db, courseId)) ?? notFound('Course');
    await q.insertSection(db, { courseId, key: `${course.key}:${body.slug}`, ...body });
    return courseId;
  });
}

export function updateSection(pool: Pool, id: number, body: UpdateSectionRequest) {
  return change(pool, async (db) => {
    const section = (await q.findSection(db, id)) ?? notFound('Section');
    await q.updateSection(db, id, body);
    if (body.position !== undefined) {
      const siblings = await q.listSectionSiblings(db, section.course_id);
      await move(db, siblings, id, body.position, q.setSectionPositions);
    }
    return section.course_id;
  });
}

export function deleteSection(pool: Pool, id: number) {
  return change(pool, async (db) => {
    const section = (await q.findSection(db, id)) ?? notFound('Section');
    await deleteOrArchive(
      db,
      () => q.deleteSection(db, id),
      () => q.archiveSection(db, id),
    );
    return section.course_id;
  });
}

export function createUnit(pool: Pool, body: CreateUnitRequest) {
  return change(pool, async (db) => {
    const section = (await q.findSection(db, body.sectionId)) ?? notFound('Section');
    await q.insertUnit(db, { key: `${section.key}:${body.slug}`, ...body });
    return section.course_id;
  });
}

export function updateUnit(pool: Pool, id: number, body: UpdateUnitRequest) {
  return change(pool, async (db) => {
    const unit = (await q.findUnit(db, id)) ?? notFound('Unit');
    await q.updateUnit(db, id, body);
    if (body.position !== undefined) {
      const siblings = await q.listUnitSiblings(db, unit.section_id);
      await move(db, siblings, id, body.position, q.setUnitPositions);
    }
    return unit.course_id;
  });
}

export function deleteUnit(pool: Pool, id: number) {
  return change(pool, async (db) => {
    const unit = (await q.findUnit(db, id)) ?? notFound('Unit');
    await deleteOrArchive(
      db,
      () => q.deleteUnit(db, id),
      () => q.archiveUnit(db, id),
    );
    return unit.course_id;
  });
}

export function createLesson(pool: Pool, body: CreateLessonRequest) {
  return change(pool, async (db) => {
    const unit = (await q.findUnit(db, body.unitId)) ?? notFound('Unit');
    await q.insertLesson(db, { key: `${unit.key}:${body.slug}`, ...body });
    return unit.course_id;
  });
}

export function updateLesson(pool: Pool, id: number, body: UpdateLessonRequest) {
  return change(pool, async (db) => {
    const lesson = (await q.findLesson(db, id)) ?? notFound('Lesson');
    await q.updateLesson(db, id, body);
    if (body.position !== undefined) {
      const siblings = await q.listLessonSiblings(db, lesson.unit_id);
      await move(db, siblings, id, body.position, q.setLessonPositions);
    }
    return lesson.course_id;
  });
}

export function deleteLesson(pool: Pool, id: number) {
  return change(pool, async (db) => {
    const lesson = (await q.findLesson(db, id)) ?? notFound('Lesson');
    await deleteOrArchive(
      db,
      () => q.deleteLesson(db, id),
      () => q.archiveLesson(db, id),
    );
    return lesson.course_id;
  });
}

import { z } from 'zod';
import { courseSchema, lessonTypeSchema } from './content';
import {
  idParamSchema,
  idSchema,
  levelCodeSchema,
  nonEmptyTextSchema,
  publishStatusSchema,
  stableKeySchema,
} from './primitives';

/** Course list, enrollment and the learning path (`/courses`; FR-020 to FR-023, SDD section 8). */

/** FR-020: a lesson's state on the learner's path. */
export const lessonStateSchema = z.enum(['locked', 'available', 'completed']);
export type LessonState = z.infer<typeof lessonStateSchema>;

/** One unit as the unlock rules see it; lessons in path order. */
export interface UnlockUnit {
  /** FR-024: a passed test-out completes the unit without its lessons. */
  testedOut: boolean;
  lessons: { completedAt: Date | null; addedAt: Date }[];
}

/**
 * FR-021, FR-232: each lesson's state, for units in path order (sections, then units).
 *
 * A unit unlocks when the one before it is finished: tested out, or every lesson completed. A
 * lesson that was added after the learner's last completion in a unit does not count against it,
 * so content added to a finished unit never locks the next one. A unit the learner has already
 * reached (any completion there or further on) stays unlocked. Inside an unlocked unit a lesson
 * is available when it is the first, follows a completed lesson, or sits before a completed one
 * (a lesson inserted behind the learner).
 */
export function lessonStates(units: readonly UnlockUnit[]): LessonState[][] {
  const reached = units.map((u) => u.testedOut || u.lessons.some((l) => l.completedAt));
  let previousOpenAndFinished = true;
  return units.map((unit, k) => {
    const unlocked = previousOpenAndFinished || reached.slice(k).some(Boolean);
    previousOpenAndFinished = unlocked && unitFinished(unit);
    const done = unit.lessons.map((l) => l.completedAt !== null);
    return done.map((completed, i): LessonState => {
      if (completed) return 'completed';
      const open = unit.testedOut || i === 0 || done[i - 1] || done.slice(i + 1).some(Boolean);
      return unlocked && open ? 'available' : 'locked';
    });
  });
}

function unitFinished(unit: UnlockUnit): boolean {
  if (unit.testedOut) return true;
  const completions = unit.lessons.flatMap((l) => (l.completedAt ? [l.completedAt.getTime()] : []));
  if (completions.length === 0) return unit.lessons.length === 0;
  const last = Math.max(...completions);
  return unit.lessons.every((l) => l.completedAt !== null || l.addedAt.getTime() > last);
}

/** `/courses/:id/...`. */
export const courseIdParamsSchema = z.object({ id: idParamSchema });

/** `GET /courses/:id/path?preview=true`: an admin sees draft units and lessons too (FR-022). */
export const coursePathQuerySchema = z.object({ preview: z.enum(['true', 'false']).optional() });

/** FR-023: a published course with the caller's enrollment and whether it is the active one. */
export const courseListEntrySchema = courseSchema.extend({
  enrolled: z.boolean(),
  active: z.boolean(),
});
export type CourseListEntry = z.infer<typeof courseListEntrySchema>;

export const courseListSchema = z.object({ courses: z.array(courseListEntrySchema) });
export type CourseList = z.infer<typeof courseListSchema>;

export const pathLessonSchema = z.object({
  id: idSchema,
  key: stableKeySchema,
  type: lessonTypeSchema,
  title: nonEmptyTextSchema,
  status: publishStatusSchema,
  state: lessonStateSchema,
});

export const pathUnitSchema = z.object({
  id: idSchema,
  key: stableKeySchema,
  title: nonEmptyTextSchema,
  status: publishStatusSchema,
  lessons: z.array(pathLessonSchema),
});

export const pathSectionSchema = z.object({
  id: idSchema,
  key: stableKeySchema,
  title: nonEmptyTextSchema,
  levelCode: levelCodeSchema,
  units: z.array(pathUnitSchema),
});

/** FR-020: `GET /courses/:id/path`, sections, units and lessons in order with the caller's state. */
export const coursePathSchema = z.object({
  course: courseSchema,
  sections: z.array(pathSectionSchema),
});
export type CoursePath = z.infer<typeof coursePathSchema>;

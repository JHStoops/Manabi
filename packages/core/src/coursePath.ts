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
  /** FR-232: the learner finished this unit once (a stored fact, unit_completions). */
  completed: boolean;
  lessons: { completed: boolean }[];
}

/**
 * FR-021, FR-232: each lesson's state, for units in path order (sections, then units).
 *
 * A unit unlocks when the one before it is finished: tested out, recorded as completed, or every
 * lesson completed. The recorded completion means lessons added to a finished unit later never
 * lock the next one. A unit the learner has already reached (any completion there or further on)
 * stays unlocked. Inside an unlocked unit a lesson is available when it is the first, follows a
 * completed lesson, or sits before a completed one (a lesson inserted behind the learner).
 */
export function lessonStates(units: readonly UnlockUnit[]): LessonState[][] {
  const reached = units.map(
    (u) => u.testedOut || u.completed || u.lessons.some((l) => l.completed),
  );
  let previousOpenAndFinished = true;
  return units.map((unit, k) => {
    const unlocked = previousOpenAndFinished || reached.slice(k).some(Boolean);
    const done = unit.lessons.map((l) => l.completed);
    previousOpenAndFinished = unlocked && (unit.testedOut || unit.completed || done.every(Boolean));
    return done.map((completed, i): LessonState => {
      if (completed) return 'completed';
      const open = unit.testedOut || i === 0 || done[i - 1] || done.slice(i + 1).some(Boolean);
      return unlocked && open ? 'available' : 'locked';
    });
  });
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

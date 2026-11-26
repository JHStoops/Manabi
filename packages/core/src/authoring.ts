import { z } from 'zod';
import { courseSchema, lessonSchema, lessonTypeSchema, sectionSchema, unitSchema } from './content';
import {
  idParamSchema,
  idSchema,
  levelCodeSchema,
  nonEmptyTextSchema,
  publishStatusSchema,
} from './primitives';

/**
 * The course tree editor (`/authoring/courses`, `/authoring/sections`, `/authoring/units`,
 * `/authoring/lessons`; FR-220, FR-225, Product Spec section 11). Admin only.
 */

/** `/authoring/<kind>/:id`. */
export const authoringIdParamsSchema = z.object({ id: idParamSchema });

/**
 * The last part of a new row's stable key; the server prefixes the parent's key, so a unit made
 * with slug `greetings` in section `ja-en:n5` gets key `ja-en:n5:greetings` (DR-02).
 */
export const keySlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/, 'Use a-z, 0-9 and -');

/** Where to move a row among its active siblings: 0 is first. */
const positionSchema = z.number().int().min(0);

const nothingToChange = (body: object) => Object.values(body).some((v) => v !== undefined);

/** One course's active (not archived) sections, units and lessons in order, drafts included. */
export const courseTreeSchema = z.object({
  course: courseSchema,
  sections: z.array(
    sectionSchema.omit({ archivedAt: true }).extend({
      units: z.array(
        unitSchema.omit({ archivedAt: true }).extend({
          lessons: z.array(lessonSchema.omit({ archivedAt: true })),
        }),
      ),
    }),
  ),
});
export type CourseTree = z.infer<typeof courseTreeSchema>;
export type TreeSection = CourseTree['sections'][number];
export type TreeUnit = TreeSection['units'][number];
export type TreeLesson = TreeUnit['lessons'][number];

/** `POST /authoring/courses/:id/sections`: added as the course's last section. */
export const createSectionRequestSchema = z.object({
  slug: keySlugSchema,
  title: nonEmptyTextSchema,
  levelCode: levelCodeSchema,
});
export type CreateSectionRequest = z.infer<typeof createSectionRequestSchema>;

export const updateSectionRequestSchema = z
  .object({
    title: nonEmptyTextSchema.optional(),
    levelCode: levelCodeSchema.optional(),
    position: positionSchema.optional(),
  })
  .refine(nothingToChange, 'Nothing to change');
export type UpdateSectionRequest = z.infer<typeof updateSectionRequestSchema>;

/** `POST /authoring/units`: added as the section's last unit, as a draft (FR-225). */
export const createUnitRequestSchema = z.object({
  sectionId: idSchema,
  slug: keySlugSchema,
  title: nonEmptyTextSchema,
});
export type CreateUnitRequest = z.infer<typeof createUnitRequestSchema>;

/** FR-225: `status: 'published'` is the publish action; it never touches learner progress. */
export const updateUnitRequestSchema = z
  .object({
    title: nonEmptyTextSchema.optional(),
    status: publishStatusSchema.optional(),
    position: positionSchema.optional(),
  })
  .refine(nothingToChange, 'Nothing to change');
export type UpdateUnitRequest = z.infer<typeof updateUnitRequestSchema>;

/** `POST /authoring/lessons`: added as the unit's last lesson, as a draft (FR-225). */
export const createLessonRequestSchema = z.object({
  unitId: idSchema,
  slug: keySlugSchema,
  type: lessonTypeSchema,
  title: nonEmptyTextSchema,
});
export type CreateLessonRequest = z.infer<typeof createLessonRequestSchema>;

export const updateLessonRequestSchema = z
  .object({
    title: nonEmptyTextSchema.optional(),
    type: lessonTypeSchema.optional(),
    status: publishStatusSchema.optional(),
    position: positionSchema.optional(),
  })
  .refine(nothingToChange, 'Nothing to change');
export type UpdateLessonRequest = z.infer<typeof updateLessonRequestSchema>;

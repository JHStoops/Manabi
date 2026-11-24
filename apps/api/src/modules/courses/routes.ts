import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  courseIdParamsSchema,
  courseListEntrySchema,
  courseListSchema,
  coursePathQuerySchema,
  coursePathSchema,
  emptyBodySchema,
  emptyQuerySchema,
} from '@manabi/core';
import { AppError } from '../../errors';
import { requireAuth, scopedUserId } from '../auth/guard';
import * as courses from './service';

const errors = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
};

/** Course list, enrollment and the learning path (SDD section 8). */
export const coursesRoutes: FastifyPluginAsyncZod = async (app) => {
  // FR-023
  app.get(
    '/courses',
    {
      schema: {
        summary:
          "Published courses (and drafts for admins), with the caller's enrollments and active course",
        tags: ['courses'],
        querystring: emptyQuerySchema,
        response: { 200: courseListSchema, ...errors },
      },
    },
    async (request) => courses.listCourses(app.db, requireAuth(request)),
  );

  // FR-023
  app.post(
    '/courses/:id/enroll',
    {
      schema: {
        summary: 'Enroll in a published course (once) and make it the active course',
        tags: ['courses'],
        querystring: emptyQuerySchema,
        params: courseIdParamsSchema,
        body: emptyBodySchema,
        response: { 200: courseListEntrySchema, ...errors },
      },
    },
    async (request) => courses.enroll(app.db, scopedUserId(request), request.params.id),
  );

  // FR-020, FR-021, FR-022
  app.get(
    '/courses/:id/path',
    {
      schema: {
        summary: "Sections, units and lessons in order with the caller's lesson states",
        description:
          'Learners see published units and lessons; `preview=true` (admins only) adds drafts.',
        tags: ['courses'],
        querystring: coursePathQuerySchema,
        params: courseIdParamsSchema,
        response: { 200: coursePathSchema, ...errors },
      },
    },
    async (request) => {
      const auth = requireAuth(request);
      const preview = request.query.preview === 'true';
      if (preview && auth.user.role !== 'admin') {
        throw new AppError('forbidden', 'Previewing drafts needs an admin account');
      }
      return courses.getPath(app.db, auth.userId, request.params.id, preview);
    },
  );
};

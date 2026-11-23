import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  emptyBodySchema,
  emptyQuerySchema,
  idempotencyHeadersSchema,
  lessonCompletionRequestSchema,
  lessonCompletionSchema,
  lessonIdParamsSchema,
  lessonSessionIdParamsSchema,
  lessonSessionSchema,
} from '@manabi/core';
import { scopedUserId } from '../auth/guard';
import * as lessons from './service';

// Lesson endpoints (SDD section 8). Test-out and unit challenges are added by the issues that
// implement them.
export const lessonsRoutes: FastifyPluginAsyncZod = async (app) => {
  // FR-041, FR-048, FR-050, FR-056
  app.post(
    '/lessons/:id/sessions',
    {
      schema: {
        summary: 'Start a lesson session, or resume the unexpired one',
        description:
          'Teaching cards for the new items, then 10 to 15 exercises with payloads and accept ' +
          'lists. A session is kept for 24 hours; starting again within that time returns it.',
        tags: ['lessons'],
        querystring: emptyQuerySchema,
        params: lessonIdParamsSchema,
        body: emptyBodySchema,
        response: {
          200: lessonSessionSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          404: apiErrorSchema,
          409: apiErrorSchema,
        },
      },
    },
    async (request) => lessons.startSession(app.db, scopedUserId(request), request.params.id),
  );
  // FR-051, FR-052, FR-053, NFR-20
  app.post(
    '/lesson-sessions/:id/complete',
    {
      schema: {
        summary: 'Complete a lesson session',
        description:
          'Re-grades the responses on the server, then records lesson progress and awards XP in ' +
          'one transaction. A retry with the same Idempotency-Key returns the first response.',
        tags: ['lessons'],
        querystring: emptyQuerySchema,
        params: lessonSessionIdParamsSchema,
        headers: idempotencyHeadersSchema,
        body: lessonCompletionRequestSchema,
        response: {
          200: lessonCompletionSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          404: apiErrorSchema,
          409: apiErrorSchema,
        },
      },
    },
    async (request) =>
      lessons.completeSession(
        app.db,
        scopedUserId(request),
        request.params.id,
        request.body,
        request.headers['idempotency-key'],
      ),
  );
};

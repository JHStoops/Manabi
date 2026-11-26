import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  emptyBodySchema,
  emptyQuerySchema,
  reviewAnswerRequestSchema,
  reviewAnswerResultSchema,
  reviewSessionIdParamsSchema,
  reviewSessionSchema,
  reviewSummarySchema,
} from '@manabi/core';
import { scopedUserId } from '../auth/guard';
import * as reviews from './service';

// Review endpoints (SDD section 8).
export const reviewsRoutes: FastifyPluginAsyncZod = async (app) => {
  // FR-113
  app.get(
    '/reviews/summary',
    {
      schema: {
        summary: 'Items due now and a 7-day forecast',
        tags: ['reviews'],
        querystring: emptyQuerySchema,
        response: { 200: reviewSummarySchema, 400: apiErrorSchema, 401: apiErrorSchema },
      },
    },
    async (request) => reviews.getSummary(app.db, scopedUserId(request)),
  );
  // FR-114, NFR-02
  app.post(
    '/reviews/sessions',
    {
      schema: {
        summary: 'Start a review session, or resume the unexpired one',
        description:
          'Up to 20 due items, oldest due first, with one exercise per due facet. A session is ' +
          'kept for 24 hours; starting again within that time returns it. 409 when nothing is due.',
        tags: ['reviews'],
        querystring: emptyQuerySchema,
        body: emptyBodySchema,
        response: {
          200: reviewSessionSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          409: apiErrorSchema,
        },
      },
    },
    async (request) => reviews.startSession(app.db, scopedUserId(request)),
  );
  // FR-112, FR-114, FR-117, NFR-20
  app.post(
    '/review-sessions/:id/answers',
    {
      schema: {
        summary: 'Answer one review exercise',
        description:
          'Re-grades the response (both attempts) on the server and saves it in one transaction. ' +
          "Once all of an item's facets in the session are answered, the item moves up a stage " +
          'if all were right, or down if any was wrong.',
        tags: ['reviews'],
        querystring: emptyQuerySchema,
        params: reviewSessionIdParamsSchema,
        body: reviewAnswerRequestSchema,
        response: {
          200: reviewAnswerResultSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          404: apiErrorSchema,
          409: apiErrorSchema,
        },
      },
    },
    async (request) =>
      reviews.answer(
        app.db,
        scopedUserId(request),
        request.params.id,
        request.body,
        app.config.srsIntervalHours,
      ),
  );
};

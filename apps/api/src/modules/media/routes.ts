import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  emptyQuerySchema,
  strokeDataSchema,
  strokeItemKeyParamsSchema,
} from '@manabi/core';
import { requireAuth } from '../auth/guard';
import * as media from './service';

/** Media for the learner's screens (SDD section 8). */
export const mediaRoutes: FastifyPluginAsyncZod = async (app) => {
  // FR-071, FR-077: Hanzi Writer character data, fetched by the stroke canvas's data loader.
  app.get(
    '/media/strokes/:itemKey',
    {
      schema: {
        summary: "A kanji's or kana's stroke data (an outline and a median per stroke)",
        tags: ['media'],
        querystring: emptyQuerySchema,
        params: strokeItemKeyParamsSchema,
        response: {
          200: strokeDataSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
    },
    async (request) => {
      requireAuth(request);
      return media.getStrokes(app.db, request.params.itemKey);
    },
  );
};

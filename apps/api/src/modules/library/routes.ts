import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  emptyQuerySchema,
  libraryItemDetailSchema,
  libraryItemKeyParamsSchema,
  libraryItemPageSchema,
  libraryItemsQuerySchema,
} from '@manabi/core';
import { requireAuth } from '../auth/guard';
import * as library from './service';

// Library endpoints (SDD section 8).
export const libraryRoutes: FastifyPluginAsyncZod = async (app) => {
  // FR-075, FR-092, FR-102
  app.get(
    '/items',
    {
      schema: {
        summary: "A course's items, filtered and searched, with the learner's stages",
        description:
          'Filters by type, level, stroke count, radical and stage band; `q` searches character, ' +
          'meaning, reading and pattern. Ordered oldest first; cursor paginated.',
        tags: ['library'],
        querystring: libraryItemsQuerySchema,
        response: {
          200: libraryItemPageSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
    },
    async (request) => library.listItems(app.db, requireAuth(request), request.query),
  );
  // FR-070, FR-092
  app.get(
    '/items/:key',
    {
      schema: {
        summary: 'One item with the learner’s facets, linked items and example sentences',
        tags: ['library'],
        params: libraryItemKeyParamsSchema,
        querystring: emptyQuerySchema,
        response: {
          200: libraryItemDetailSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
    },
    async (request) => library.getItem(app.db, requireAuth(request), request.params.key),
  );
};

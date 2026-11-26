import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  authoringItemIdParamsSchema,
  authoringItemListSchema,
  authoringItemQuerySchema,
  authoringItemSchema,
  emptyQuerySchema,
  updateItemOverridesRequestSchema,
} from '@manabi/core';
import * as authoring from './itemsService';

const errors = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
  409: apiErrorSchema,
};

/**
 * `/authoring/items`: the item editor (FR-221). The auth guard requires the admin role for
 * everything under /authoring.
 */
export const itemsRoutes: FastifyPluginAsyncZod = async (app) => {
  const tags = ['authoring'];

  app.get(
    '/authoring/items',
    {
      schema: {
        summary: "A course's active items whose key contains `q`, first 50 by key",
        tags,
        querystring: authoringItemQuerySchema,
        response: { 200: authoringItemListSchema, ...errors },
      },
    },
    async (request) => ({ items: await authoring.listItems(app.db, request.query) }),
  );

  app.get(
    '/authoring/items/:id',
    {
      schema: {
        summary: "An item's imported data, author overrides, merged data and form fields",
        tags,
        querystring: emptyQuerySchema,
        params: authoringItemIdParamsSchema,
        response: { 200: authoringItemSchema, ...errors },
      },
    },
    async (request) => authoring.getItem(app.db, request.params.id),
  );

  app.patch(
    '/authoring/items/:id',
    {
      schema: {
        summary: "Replace an item's overrides; the merged data must pass the language schema",
        tags,
        querystring: emptyQuerySchema,
        params: authoringItemIdParamsSchema,
        body: updateItemOverridesRequestSchema,
        response: { 200: authoringItemSchema, ...errors },
      },
    },
    async (request) =>
      authoring.updateItemOverrides(app.db, request.params.id, request.body.overrides),
  );
};

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { apiErrorSchema, emptyQuerySchema, userStatsSchema } from '@manabi/core';
import { scopedUserId } from '../auth/guard';
import * as stats from './service';

/** The caller's daily goal and streak (FR-161, FR-163, FR-164). */
export const statsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me/stats',
    {
      schema: {
        summary: "The caller's daily goal, today's XP and streak",
        tags: ['stats'],
        querystring: emptyQuerySchema,
        response: { 200: userStatsSchema, 401: apiErrorSchema, 404: apiErrorSchema },
      },
    },
    async (request) => stats.getStats(app.db, scopedUserId(request)),
  );
};

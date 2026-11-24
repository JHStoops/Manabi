import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  emptyQuerySchema,
  streakFreezeChoiceSchema,
  userStatsSchema,
} from '@manabi/core';
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

  // FR-164
  app.post(
    '/me/streak/freezes',
    {
      schema: {
        summary: 'Spend the streak freezes on offer to keep the streak, or let it reset',
        tags: ['stats'],
        querystring: emptyQuerySchema,
        body: streakFreezeChoiceSchema,
        response: {
          200: userStatsSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          409: apiErrorSchema,
        },
      },
    },
    async (request) => stats.chooseFreezes(app.db, scopedUserId(request), request.body.spend),
  );
};

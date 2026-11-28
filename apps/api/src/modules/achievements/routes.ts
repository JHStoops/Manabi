import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  achievementListSchema,
  achievementsSeenRequestSchema,
  apiErrorSchema,
  emptyQuerySchema,
} from '@manabi/core';
import { scopedUserId } from '../auth/guard';
import * as achievements from './service';

/** The caller's achievements and their one-time celebrations (FR-165). */
export const achievementsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me/achievements',
    {
      schema: {
        summary: 'Every achievement, with when the caller earned it and saw its celebration',
        tags: ['achievements'],
        querystring: emptyQuerySchema,
        response: { 200: achievementListSchema, 401: apiErrorSchema },
      },
    },
    async (request) => achievements.listAchievements(app.db, scopedUserId(request)),
  );

  app.post(
    '/me/achievements/seen',
    {
      schema: {
        summary: 'Record that the celebrations of these achievements were shown',
        tags: ['achievements'],
        querystring: emptyQuerySchema,
        body: achievementsSeenRequestSchema,
        response: {
          200: achievementListSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
        },
      },
    },
    async (request) => achievements.markSeen(app.db, scopedUserId(request), request.body.keys),
  );
};

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { apiErrorSchema, emptyQuerySchema, healthResponseSchema } from '@manabi/core';
import { AppError } from '../../errors';
import { checkHealth } from './service';

/** FR-203: `GET /api/v1/healthz`, unauthenticated, for Nginx Proxy Manager or an uptime monitor. */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/healthz',
    {
      schema: {
        summary: 'API and database status',
        tags: ['health'],
        querystring: emptyQuerySchema,
        response: { 200: healthResponseSchema, 503: apiErrorSchema },
      },
    },
    async () => {
      const details = await checkHealth(app.db);
      if (details.database !== 'ok') {
        throw new AppError('service_unavailable', 'Database unavailable', details);
      }
      return { status: 'ok' as const, api: 'ok' as const, database: 'ok' as const };
    },
  );
};

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { adminRoutes } from './admin/routes';
import { authRoutes } from './auth/routes';
import { authoringRoutes } from './authoring/routes';
import { contentRoutes } from './content/routes';
import { coursesRoutes } from './courses/routes';
import { healthRoutes } from './health/routes';
import { lessonsRoutes } from './lessons/routes';
import { reviewsRoutes } from './reviews/routes';
import { socialRoutes } from './social/routes';
import { statsRoutes } from './stats/routes';

/**
 * Every feature module's routes, registered under /api/v1 by `buildApp`. Each module folder has
 * routes.ts (HTTP and Zod validation, no SQL), service.ts (business rules, transactions) and
 * queries.ts (all SQL).
 */
export const featureModules: readonly FastifyPluginAsyncZod[] = [
  healthRoutes,
  authRoutes,
  coursesRoutes,
  lessonsRoutes,
  statsRoutes,
  reviewsRoutes,
  socialRoutes,
  adminRoutes,
  contentRoutes,
  authoringRoutes,
];

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { adminRoutes } from './admin/routes';
import { authRoutes } from './auth/routes';
import { lessonEditorRoutes } from './authoring/lessonEditorRoutes';
import { authoringRoutes } from './authoring/routes';
import { itemsRoutes } from './authoring/itemsRoutes';
import { sentencesRoutes } from './authoring/sentencesRoutes';
import { wordListsRoutes } from './authoring/wordListsRoutes';
import { contentRoutes } from './content/routes';
import { coursesRoutes } from './courses/routes';
import { healthRoutes } from './health/routes';
import { lessonsRoutes } from './lessons/routes';
import { libraryRoutes } from './library/routes';
import { mediaRoutes } from './media/routes';
import { reportsRoutes } from './reports/routes';
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
  libraryRoutes,
  socialRoutes,
  adminRoutes,
  contentRoutes,
  authoringRoutes,
  wordListsRoutes,
  lessonEditorRoutes,
  itemsRoutes,
  sentencesRoutes,
  mediaRoutes,
  reportsRoutes,
];

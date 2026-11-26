import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  authoringIdParamsSchema,
  courseTreeSchema,
  createLessonRequestSchema,
  createSectionRequestSchema,
  createUnitRequestSchema,
  emptyQuerySchema,
  updateLessonRequestSchema,
  updateSectionRequestSchema,
  updateUnitRequestSchema,
} from '@manabi/core';
import * as authoring from './service';

const errors = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
  409: apiErrorSchema,
};

const tags = ['authoring'];
const querystring = emptyQuerySchema;
const params = authoringIdParamsSchema;
const response = { 200: courseTreeSchema, ...errors };

/**
 * FR-220, FR-225: the course tree editor. The auth guard requires the admin role for everything
 * under /authoring (FR-006). Every change answers with the course's whole tree.
 */
export const authoringRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/authoring/courses/:id',
    {
      schema: {
        summary: "A course's sections, units and lessons in order, drafts included",
        tags,
        querystring,
        params,
        response,
      },
    },
    async (request) => authoring.getTree(app.db, request.params.id),
  );

  app.post(
    '/authoring/courses/:id/sections',
    {
      schema: {
        summary: "Add a section at the end of the course; its key is the course's key plus slug",
        tags,
        querystring,
        params,
        body: createSectionRequestSchema,
        response,
      },
    },
    async (request) => authoring.createSection(app.db, request.params.id, request.body),
  );

  app.patch(
    '/authoring/sections/:id',
    {
      schema: {
        summary: 'Rename a section, change its level or move it to another position',
        tags,
        querystring,
        params,
        body: updateSectionRequestSchema,
        response,
      },
    },
    async (request) => authoring.updateSection(app.db, request.params.id, request.body),
  );

  app.delete(
    '/authoring/sections/:id',
    {
      schema: {
        summary: 'Delete a section with its units and lessons; archived instead if it has progress',
        tags,
        querystring,
        params,
        response,
      },
    },
    async (request) => authoring.deleteSection(app.db, request.params.id),
  );

  app.post(
    '/authoring/units',
    {
      schema: {
        summary: 'Add a draft unit at the end of a section',
        tags,
        querystring,
        body: createUnitRequestSchema,
        response,
      },
    },
    async (request) => authoring.createUnit(app.db, request.body),
  );

  app.patch(
    '/authoring/units/:id',
    {
      schema: {
        summary: 'Rename, publish or unpublish a unit, or move it to another position',
        tags,
        querystring,
        params,
        body: updateUnitRequestSchema,
        response,
      },
    },
    async (request) => authoring.updateUnit(app.db, request.params.id, request.body),
  );

  app.delete(
    '/authoring/units/:id',
    {
      schema: {
        summary: 'Delete a unit with its lessons; archived instead if it has progress',
        tags,
        querystring,
        params,
        response,
      },
    },
    async (request) => authoring.deleteUnit(app.db, request.params.id),
  );

  app.post(
    '/authoring/lessons',
    {
      schema: {
        summary: 'Add a draft lesson at the end of a unit',
        tags,
        querystring,
        body: createLessonRequestSchema,
        response,
      },
    },
    async (request) => authoring.createLesson(app.db, request.body),
  );

  app.patch(
    '/authoring/lessons/:id',
    {
      schema: {
        summary: 'Rename, retype, publish or unpublish a lesson, or move it to another position',
        tags,
        querystring,
        params,
        body: updateLessonRequestSchema,
        response,
      },
    },
    async (request) => authoring.updateLesson(app.db, request.params.id, request.body),
  );

  app.delete(
    '/authoring/lessons/:id',
    {
      schema: {
        summary: 'Delete a lesson; archived instead if it has progress',
        tags,
        querystring,
        params,
        response,
      },
    },
    async (request) => authoring.deleteLesson(app.db, request.params.id),
  );
};

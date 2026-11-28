import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  authoringIdParamsSchema,
  createExerciseRequestSchema,
  emptyBodySchema,
  emptyQuerySchema,
  exerciseWriteSchema,
  generatedExercisesSchema,
  lessonEditorSchema,
  retieExerciseSchema,
  lessonPreviewSchema,
  setLessonItemsRequestSchema,
  updateExerciseRequestSchema,
} from '@manabi/core';
import * as editor from './lessonEditorService';

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

/**
 * FR-223, FR-224: the lesson editor. The auth guard requires the admin role for everything under
 * /authoring (FR-006).
 */
export const lessonEditorRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/authoring/lessons/:id/editor',
    {
      schema: {
        summary: "A lesson's new items and its authored and pinned exercises, in session order",
        tags,
        querystring,
        params,
        response: { 200: lessonEditorSchema, ...errors },
      },
    },
    async (request) => editor.getLessonEditor(app.db, request.params.id),
  );

  app.put(
    '/authoring/lessons/:id/items',
    {
      schema: {
        summary: "Set the lesson's new items, in teaching order",
        tags,
        querystring,
        params,
        body: setLessonItemsRequestSchema,
        response: { 200: lessonEditorSchema, ...errors },
      },
    },
    async (request) => editor.setLessonItems(app.db, request.params.id, request.body),
  );

  app.get(
    '/authoring/lessons/:id/generated',
    {
      schema: {
        summary: "Exercises the lesson type's generators make from its new items, to pin",
        tags,
        querystring,
        params,
        response: { 200: generatedExercisesSchema, ...errors },
      },
    },
    async (request) => editor.getGenerated(app.db, request.params.id),
  );

  app.post(
    '/authoring/lessons/:id/preview',
    {
      schema: {
        summary: 'Build the lesson as a learner would get it, without saving a session',
        description: 'Drafts included. Nothing is written, so a preview records no progress or XP.',
        tags,
        querystring,
        params,
        body: emptyBodySchema,
        response: { 200: lessonPreviewSchema, ...errors },
      },
    },
    async (request) => editor.getPreview(app.db, request.params.id),
  );

  app.post(
    '/authoring/exercises',
    {
      schema: {
        summary: 'Add an authored or pinned exercise at the end of a lesson',
        description:
          'The payload is validated by its exercise type. Answer text without tiles is ' +
          'segmented; blocklist words found come back as a warning.',
        tags,
        querystring,
        body: createExerciseRequestSchema,
        response: { 201: exerciseWriteSchema, ...errors },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await editor.createExercise(app.db, request.body)),
  );

  app.patch(
    '/authoring/exercises/:id',
    {
      schema: {
        summary: "Replace a lesson's or an item-level exercise's payload",
        description:
          'Tiles sent are kept; answer text without tiles is segmented, and resegment ' +
          're-segments every answer text. Blocklist words found come back as a warning.',
        tags,
        querystring,
        params,
        body: updateExerciseRequestSchema,
        response: { 200: exerciseWriteSchema, ...errors },
      },
    },
    async (request) => editor.updateExercise(app.db, request.params.id, request.body),
  );

  app.post(
    '/authoring/exercises/:id/retie',
    {
      schema: {
        summary: 'Tie a pin to an exercise the generators make now (#259)',
        description:
          "For a pin marked detached: records the generated exercise closest to the pin's " +
          'payload as its original. The payload and accept list stay. 409 when none is made.',
        tags,
        querystring,
        params,
        body: emptyBodySchema,
        response: { 200: retieExerciseSchema, ...errors },
      },
    },
    async (request) => editor.retieExercise(app.db, request.params.id),
  );

  app.delete(
    '/authoring/exercises/:id',
    {
      schema: {
        summary: 'Remove an exercise; archived instead if an answer report refers to it',
        tags,
        querystring,
        params,
        response: { 200: lessonEditorSchema, ...errors },
      },
    },
    async (request) => editor.deleteExercise(app.db, request.params.id),
  );
};

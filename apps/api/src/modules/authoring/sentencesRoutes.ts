import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  authoringSentenceIdParamsSchema,
  authoringSentenceListSchema,
  authoringSentenceQuerySchema,
  authoringSentenceSchema,
  createSentenceRequestSchema,
  emptyQuerySchema,
  updateSentenceRequestSchema,
} from '@manabi/core';
import * as editor from './sentencesService';

const errors = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
};

/**
 * `/authoring/sentences`: the sentence editor (FR-059, FR-236, FR-238, DR-11). The auth guard
 * requires the admin role for everything under /authoring.
 */
export const sentencesRoutes: FastifyPluginAsyncZod = async (app) => {
  const tags = ['authoring'];

  app.get(
    '/authoring/sentences',
    {
      schema: {
        summary: "A course's active sentences by review status, grammar point or text, first 50",
        tags,
        querystring: authoringSentenceQuerySchema,
        response: { 200: authoringSentenceListSchema, ...errors },
      },
    },
    async (request) => ({ sentences: await editor.listSentences(app.db, request.query) }),
  );

  app.get(
    '/authoring/sentences/:id',
    {
      schema: {
        summary: 'A sentence with its challenge status and blocklist warnings',
        tags,
        querystring: emptyQuerySchema,
        params: authoringSentenceIdParamsSchema,
        response: { 200: authoringSentenceSchema, ...errors },
      },
    },
    async (request) => editor.getSentence(app.db, request.params.id),
  );

  app.post(
    '/authoring/sentences',
    {
      schema: {
        summary: 'Create an authored sentence, segmented and with its grammar detected',
        tags,
        querystring: emptyQuerySchema,
        body: createSentenceRequestSchema,
        response: { 201: authoringSentenceSchema, ...errors },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await editor.createSentence(app.db, request.body)),
  );

  app.patch(
    '/authoring/sentences/:id',
    {
      schema: {
        summary: "Edit a sentence's text, translation, tiles, review status or challenge status",
        tags,
        querystring: emptyQuerySchema,
        params: authoringSentenceIdParamsSchema,
        body: updateSentenceRequestSchema,
        response: { 200: authoringSentenceSchema, ...errors },
      },
    },
    async (request) => editor.updateSentence(app.db, request.params.id, request.body),
  );
};

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  blockedWordListSchema,
  blockedWordQuerySchema,
  blockedWordSchema,
  createBlockedWordRequestSchema,
  createSupplementaryWordRequestSchema,
  emptyQuerySchema,
  supplementaryWordListSchema,
  supplementaryWordQuerySchema,
  supplementaryWordSchema,
  updateSupplementaryWordRequestSchema,
  wordListIdParamsSchema,
  z,
} from '@manabi/core';
import * as authoring from './wordListsService';

const noContent = z.null();

const errors = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
  409: apiErrorSchema,
};

/**
 * `/authoring/word-lists`: the supplementary words (FR-234) and the blocklist (FR-237). The auth
 * guard requires the admin role for everything under /authoring.
 */
export const wordListsRoutes: FastifyPluginAsyncZod = async (app) => {
  const tags = ['authoring'];

  app.get(
    '/authoring/word-lists/supplementary-words',
    {
      schema: {
        summary: 'Supplementary words, optionally of one course or level',
        tags,
        querystring: supplementaryWordQuerySchema,
        response: { 200: supplementaryWordListSchema, ...errors },
      },
    },
    async (request) => ({ words: await authoring.listSupplementaryWords(app.db, request.query) }),
  );

  app.post(
    '/authoring/word-lists/supplementary-words',
    {
      schema: {
        summary: 'Add a supplementary word to a course level',
        tags,
        querystring: emptyQuerySchema,
        body: createSupplementaryWordRequestSchema,
        response: { 201: supplementaryWordSchema, ...errors },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await authoring.addSupplementaryWord(app.db, request.body)),
  );

  app.patch(
    '/authoring/word-lists/supplementary-words/:id',
    {
      schema: {
        summary: 'Edit a supplementary word',
        tags,
        querystring: emptyQuerySchema,
        params: wordListIdParamsSchema,
        body: updateSupplementaryWordRequestSchema,
        response: { 200: supplementaryWordSchema, ...errors },
      },
    },
    async (request) => authoring.editSupplementaryWord(app.db, request.params.id, request.body),
  );

  app.delete(
    '/authoring/word-lists/supplementary-words/:id',
    {
      schema: {
        summary: 'Remove a supplementary word',
        tags,
        querystring: emptyQuerySchema,
        params: wordListIdParamsSchema,
        response: { 204: noContent, ...errors },
      },
    },
    async (request, reply) => {
      await authoring.removeSupplementaryWord(app.db, request.params.id);
      return reply.status(204).send(null);
    },
  );

  app.get(
    '/authoring/word-lists/blocked-words',
    {
      schema: {
        summary: 'Blocked words, optionally of one language',
        tags,
        querystring: blockedWordQuerySchema,
        response: { 200: blockedWordListSchema, ...errors },
      },
    },
    async (request) => ({ words: await authoring.listBlockedWords(app.db, request.query.lang) }),
  );

  app.post(
    '/authoring/word-lists/blocked-words',
    {
      schema: {
        summary: 'Block a word of a language',
        tags,
        querystring: emptyQuerySchema,
        body: createBlockedWordRequestSchema,
        response: { 201: blockedWordSchema, ...errors },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await authoring.addBlockedWord(app.db, request.body)),
  );

  app.delete(
    '/authoring/word-lists/blocked-words/:id',
    {
      schema: {
        summary: 'Unblock a word',
        tags,
        querystring: emptyQuerySchema,
        params: wordListIdParamsSchema,
        response: { 204: noContent, ...errors },
      },
    },
    async (request, reply) => {
      await authoring.removeBlockedWord(app.db, request.params.id);
      return reply.status(204).send(null);
    },
  );
};

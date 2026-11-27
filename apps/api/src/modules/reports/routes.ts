import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  answerReportPageSchema,
  answerReportReceiptSchema,
  answerReportSchema,
  answerReportsQuerySchema,
  apiErrorSchema,
  authoringIdParamsSchema,
  createAnswerReportRequestSchema,
  emptyBodySchema,
  emptyQuerySchema,
} from '@manabi/core';
import { scopedUserId } from '../auth/guard';
import * as reports from './service';

const errors = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
  409: apiErrorSchema,
};

/**
 * FR-054, FR-229: answer reports. Any signed-in learner files one; the auth guard requires the
 * admin role for everything under /authoring (FR-006), so only an admin lists and resolves them.
 */
export const reportsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/answer-reports',
    {
      schema: {
        summary: 'Report an answer that should be accepted',
        description:
          'Names the exercise by the session it was played in and its type and payload as ' +
          'served; the server reports its own copy. Only exercises with an accept list, and only ' +
          'answers graded wrong. Filing the same open report again returns it with 200.',
        tags: ['reports'],
        querystring: emptyQuerySchema,
        body: createAnswerReportRequestSchema,
        response: { 200: answerReportReceiptSchema, 201: answerReportReceiptSchema, ...errors },
      },
    },
    async (request, reply) => {
      const { report, created } = await reports.fileReport(
        app.db,
        scopedUserId(request),
        request.body,
      );
      return reply.status(created ? 201 : 200).send(report);
    },
  );

  app.get(
    '/authoring/reports',
    {
      schema: {
        summary: 'Answer reports of a status (open by default), oldest first',
        tags: ['authoring'],
        querystring: answerReportsQuerySchema,
        response: { 200: answerReportPageSchema, ...errors },
      },
    },
    async (request) => reports.listReports(app.db, request.query),
  );

  app.post(
    '/authoring/reports/:id/accept',
    {
      schema: {
        summary: "Accept a report: add its answer to the exercise's accept list",
        description:
          'A generated exercise is pinned first (into the lesson it was played in, or at item ' +
          'level for reviews and test-outs), so the accept list persists.',
        tags: ['authoring'],
        querystring: emptyQuerySchema,
        params: authoringIdParamsSchema,
        body: emptyBodySchema,
        response: { 200: answerReportSchema, ...errors },
      },
    },
    async (request) => reports.acceptReport(app.db, scopedUserId(request), request.params.id),
  );

  app.post(
    '/authoring/reports/:id/dismiss',
    {
      schema: {
        summary: 'Dismiss a report; the exercise is unchanged',
        tags: ['authoring'],
        querystring: emptyQuerySchema,
        params: authoringIdParamsSchema,
        body: emptyBodySchema,
        response: { 200: answerReportSchema, ...errors },
      },
    },
    async (request) => reports.dismissReport(app.db, scopedUserId(request), request.params.id),
  );
};

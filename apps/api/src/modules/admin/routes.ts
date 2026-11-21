import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  adminIdParamsSchema,
  adminUserListSchema,
  adminUserSchema,
  apiErrorSchema,
  createInviteRequestSchema,
  createInviteResponseSchema,
  emptyQuerySchema,
  importRunListSchema,
  inviteListSchema,
  startImportRequestSchema,
  startImportResponseSchema,
  temporaryPasswordRequestSchema,
  updateUserRequestSchema,
  z,
} from '@manabi/core';
import { scopedUserId } from '../auth/guard';
import * as admin from './service';

/** 204 responses have no body. */
const noContent = z.null();

const errors = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
  409: apiErrorSchema,
};

/**
 * The admin console's users, invites and imports (Product Spec section 11, SDD section 8). The
 * auth guard requires the admin role for everything under /admin.
 */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  // FR-200
  app.get(
    '/admin/users',
    {
      schema: {
        summary: 'Every user with role, last active day and streak',
        tags: ['admin'],
        querystring: emptyQuerySchema,
        response: { 200: adminUserListSchema, ...errors },
      },
    },
    async () => ({ users: await admin.listUsers(app.db) }),
  );

  // FR-200
  app.patch(
    '/admin/users/:id',
    {
      schema: {
        summary: "Change a user's role, or disable (signing them out) or re-enable the account",
        tags: ['admin'],
        querystring: emptyQuerySchema,
        params: adminIdParamsSchema,
        body: updateUserRequestSchema,
        response: { 200: adminUserSchema, ...errors },
      },
    },
    async (request) =>
      admin.updateUser(app.db, scopedUserId(request), request.params.id, request.body),
  );

  // FR-005, FR-200
  app.post(
    '/admin/users/:id/temporary-password',
    {
      schema: {
        summary: 'Set a temporary password (7 days, must be changed at sign-in); signs them out',
        tags: ['admin'],
        querystring: emptyQuerySchema,
        params: adminIdParamsSchema,
        body: temporaryPasswordRequestSchema,
        response: { 204: noContent, ...errors },
      },
    },
    async (request, reply) => {
      await admin.setUserTemporaryPassword(app.db, request.params.id, request.body.password);
      return reply.status(204).send(null);
    },
  );

  // FR-002
  app.get(
    '/admin/invites',
    {
      schema: {
        summary: 'Every invite, newest first',
        tags: ['admin'],
        querystring: emptyQuerySchema,
        response: { 200: inviteListSchema, ...errors },
      },
    },
    async () => ({ invites: await admin.listInvites(app.db) }),
  );

  // FR-002, IF-10
  app.post(
    '/admin/invites',
    {
      schema: {
        summary:
          'Create an invite; returns its link and emails it when SMTP and an address are set',
        tags: ['admin'],
        querystring: emptyQuerySchema,
        body: createInviteRequestSchema,
        response: { 201: createInviteResponseSchema, ...errors },
      },
    },
    async (request, reply) => {
      const created = await admin.createInvite(
        app.db,
        {
          smtp: app.config.smtp,
          publicUrl: app.config.publicUrl,
          actor: scopedUserId(request),
          log: request.log,
        },
        request.body,
      );
      return reply.status(201).send(created);
    },
  );

  // FR-002
  app.delete(
    '/admin/invites/:id',
    {
      schema: {
        summary: 'Revoke an unused invite',
        tags: ['admin'],
        querystring: emptyQuerySchema,
        params: adminIdParamsSchema,
        response: { 204: noContent, ...errors },
      },
    },
    async (request, reply) => {
      await admin.revokeInvite(app.db, request.params.id);
      return reply.status(204).send(null);
    },
  );

  // FR-226
  app.get(
    '/admin/imports',
    {
      schema: {
        summary: 'The latest dataset import runs, newest first',
        tags: ['admin'],
        querystring: emptyQuerySchema,
        response: { 200: importRunListSchema, ...errors },
      },
    },
    async () => ({ runs: await admin.listImportRuns(app.db) }),
  );

  // FR-226
  app.post(
    '/admin/imports',
    {
      schema: {
        summary: 'Start (or re-run) a dataset import in the worker',
        tags: ['admin'],
        querystring: emptyQuerySchema,
        body: startImportRequestSchema,
        response: { 202: startImportResponseSchema, ...errors, 503: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const jobId = await admin.startImport(app.jobs, request.body);
      return reply.status(202).send({ jobId });
    },
  );
};

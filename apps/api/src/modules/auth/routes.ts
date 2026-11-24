import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  acceptInviteRequestSchema,
  apiErrorSchema,
  authResponseSchema,
  changePasswordRequestSchema,
  emptyBodySchema,
  emptyQuerySchema,
  loginRequestSchema,
  opaqueTokenSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  sessionListSchema,
  sessionParamsSchema,
  updateMeRequestSchema,
  userSchema,
  z,
} from '@manabi/core';
import { sendMail } from '../../mailer';
import { clearSessionCookie, deliverSession, requireAuth, SESSION_COOKIE } from './guard';
import { prepareDummyHash } from './passwords';
import * as auth from './service';

/** 204 responses have no body. */
const noContent = z.null();

const errors = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
  409: apiErrorSchema,
  429: apiErrorSchema,
};

/**
 * Sign-in, invites, sessions and passwords (SDD sections 8 and 11). The auth guard
 * (guard.ts, registered by buildApp) runs before these handlers.
 */
export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // Stable timing for unknown names from the first sign-in on.
  await prepareDummyHash();

  // FR-003, NFR-12
  app.post(
    '/auth/login',
    {
      config: { public: true },
      schema: {
        summary: 'Sign in by username or email and password',
        tags: ['auth'],
        querystring: emptyQuerySchema,
        body: loginRequestSchema,
        response: { 200: authResponseSchema, ...errors },
      },
    },
    async (request, reply) => {
      const cookie = request.cookies[SESSION_COOKIE];
      const previous = opaqueTokenSchema.safeParse(cookie).success ? cookie : undefined;
      const issued = await auth.login(
        app.db,
        app.attemptLimiter,
        request.ip,
        request.body,
        previous,
      );
      return deliverSession(request, reply, issued);
    },
  );

  // FR-001, NFR-12
  app.post(
    '/auth/accept-invite',
    {
      config: { public: true },
      schema: {
        summary: 'Create an account from an invite and sign in',
        tags: ['auth'],
        querystring: emptyQuerySchema,
        body: acceptInviteRequestSchema,
        response: { 201: authResponseSchema, ...errors },
      },
    },
    async (request, reply) => {
      const issued = await auth.acceptInvite(app.db, app.attemptLimiter, request.ip, request.body);
      return reply.status(201).send(deliverSession(request, reply, issued));
    },
  );

  // FR-004
  app.post(
    '/auth/logout',
    {
      config: { allowPasswordChangeRequired: true },
      schema: {
        summary: 'Sign out this session',
        tags: ['auth'],
        querystring: emptyQuerySchema,
        body: emptyBodySchema,
        response: { 204: noContent, 401: apiErrorSchema, 403: apiErrorSchema },
      },
    },
    async (request, reply) => {
      await auth.logout(app.db, requireAuth(request));
      clearSessionCookie(request, reply);
      return reply.status(204).send(null);
    },
  );

  // FR-005, SDD section 11, NFR-12
  app.post(
    '/auth/change-password',
    {
      config: { allowPasswordChangeRequired: true },
      schema: {
        summary: 'Choose a new password; signs out every other session',
        tags: ['auth'],
        querystring: emptyQuerySchema,
        body: changePasswordRequestSchema,
        response: { 200: authResponseSchema, ...errors },
      },
    },
    async (request, reply) => {
      const issued = await auth.changePassword(
        app.db,
        app.attemptLimiter,
        request.ip,
        requireAuth(request),
        request.body,
      );
      return deliverSession(request, reply, issued);
    },
  );

  // FR-005, IF-10, NFR-12
  app.post(
    '/auth/password-reset',
    {
      config: { public: true },
      schema: {
        summary: 'Email a password-reset link (needs SMTP); answers alike for unknown accounts',
        tags: ['auth'],
        querystring: emptyQuerySchema,
        body: passwordResetRequestSchema,
        response: { 202: noContent, 400: apiErrorSchema, 429: apiErrorSchema, 503: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const { smtp, publicUrl } = app.config;
      const mail = await auth.requestPasswordReset(
        app.db,
        app.attemptLimiter,
        request.ip,
        smtp,
        publicUrl,
        request.body,
      );
      // Sent after answering, so the response time does not reveal whether the account exists.
      if (mail && smtp) {
        sendMail(smtp, mail).catch((err: unknown) =>
          request.log.error({ err }, 'password reset email not sent'),
        );
      }
      return reply.status(202).send(null);
    },
  );

  // FR-005, NFR-12
  app.post(
    '/auth/password-reset/confirm',
    {
      config: { public: true },
      schema: {
        summary: 'Choose a new password with an emailed reset token; signs out every session',
        tags: ['auth'],
        querystring: emptyQuerySchema,
        body: passwordResetConfirmSchema,
        response: { 204: noContent, ...errors },
      },
    },
    async (request, reply) => {
      await auth.confirmPasswordReset(app.db, app.attemptLimiter, request.ip, request.body);
      return reply.status(204).send(null);
    },
  );

  app.get(
    '/me',
    {
      // The web app reads mustChangePassword here to show the change-password screen.
      config: { allowPasswordChangeRequired: true },
      schema: {
        summary: 'The signed-in user',
        tags: ['auth'],
        querystring: emptyQuerySchema,
        response: { 200: userSchema, 401: apiErrorSchema },
      },
    },
    async (request) => auth.me(requireAuth(request)),
  );

  // FR-007, NFR-14, NFR-61
  app.patch(
    '/me',
    {
      schema: {
        summary: 'Change your display name, time zone or settings',
        tags: ['auth'],
        querystring: emptyQuerySchema,
        body: updateMeRequestSchema,
        response: {
          200: userSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
        },
      },
    },
    async (request) => auth.updateMe(app.db, requireAuth(request), request.body),
  );

  // FR-004
  app.get(
    '/me/sessions',
    {
      schema: {
        summary: "The signed-in user's active sessions",
        tags: ['auth'],
        querystring: emptyQuerySchema,
        response: { 200: sessionListSchema, 401: apiErrorSchema, 403: apiErrorSchema },
      },
    },
    async (request) => ({ sessions: await auth.listSessions(app.db, requireAuth(request)) }),
  );

  // FR-004, NFR-14
  app.delete(
    '/me/sessions/:id',
    {
      schema: {
        summary: 'Revoke one of your sessions',
        tags: ['auth'],
        querystring: emptyQuerySchema,
        params: sessionParamsSchema,
        response: {
          204: noContent,
          401: apiErrorSchema,
          403: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const current = requireAuth(request);
      await auth.revokeSession(app.db, current, request.params.id);
      if (request.params.id === current.sessionId) clearSessionCookie(request, reply);
      return reply.status(204).send(null);
    },
  );
};

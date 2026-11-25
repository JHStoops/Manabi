import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  apiErrorSchema,
  emptyBodySchema,
  emptyQuerySchema,
  friendListSchema,
  nudgeListSchema,
  publicProfileSchema,
  sendNudgeRequestSchema,
  userIdParamsSchema,
} from '@manabi/core';
import { requireAuth, scopedUserId } from '../auth/guard';
import * as social from './service';

const noContent = z.null();
const errors = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
  409: apiErrorSchema,
};

/** Follows, friends, profiles and nudges (FR-182 to FR-184, SDD section 8). */
export const socialRoutes: FastifyPluginAsyncZod = async (app) => {
  const tags = ['social'];

  // FR-182
  app.put(
    '/follows/:userId',
    {
      schema: {
        summary: 'Follow a learner (one-way, no approval; repeating it changes nothing)',
        tags,
        querystring: emptyQuerySchema,
        params: userIdParamsSchema,
        body: emptyBodySchema,
        response: { 204: noContent, ...errors },
      },
    },
    async (request, reply) => {
      await social.follow(app.db, scopedUserId(request), request.params.userId);
      return reply.status(204).send(null);
    },
  );

  // FR-182
  app.delete(
    '/follows/:userId',
    {
      schema: {
        summary: 'Unfollow a learner (unfollowing someone not followed changes nothing)',
        tags,
        querystring: emptyQuerySchema,
        params: userIdParamsSchema,
        response: { 204: noContent, ...errors },
      },
    },
    async (request, reply) => {
      await social.unfollow(app.db, scopedUserId(request), request.params.userId);
      return reply.status(204).send(null);
    },
  );

  // FR-182
  app.get(
    '/friends',
    {
      schema: {
        summary: 'Learners the caller follows, with streak, level, weekly XP and section',
        tags,
        querystring: emptyQuerySchema,
        response: { 200: friendListSchema, ...errors },
      },
    },
    async (request) => social.listFriends(app.db, scopedUserId(request)),
  );

  // FR-182
  app.get(
    '/users/:userId/profile',
    {
      schema: {
        summary: "A learner's public profile (no email, username or settings)",
        tags,
        querystring: emptyQuerySchema,
        params: userIdParamsSchema,
        response: { 200: publicProfileSchema, ...errors },
      },
    },
    async (request) => social.getProfile(app.db, scopedUserId(request), request.params.userId),
  );

  // FR-183, FR-184
  app.post(
    '/nudges',
    {
      schema: {
        summary: 'Nudge a friend: once per friend per day, not to learners who opted out',
        tags,
        querystring: emptyQuerySchema,
        body: sendNudgeRequestSchema,
        response: { 204: noContent, ...errors },
      },
    },
    async (request, reply) => {
      await social.sendNudge(
        app.db,
        requireAuth(request),
        request.body.toUserId,
        request.body.kind,
      );
      return reply.status(204).send(null);
    },
  );

  // FR-183
  app.get(
    '/nudges',
    {
      schema: {
        summary: "The caller's newest nudges, read on app load",
        tags,
        querystring: emptyQuerySchema,
        response: { 200: nudgeListSchema, ...errors },
      },
    },
    async (request) => social.listNudges(app.db, scopedUserId(request)),
  );

  // FR-183
  app.post(
    '/nudges/seen',
    {
      schema: {
        summary: 'Mark all of the caller’s nudges as seen',
        tags,
        querystring: emptyQuerySchema,
        body: emptyBodySchema,
        response: { 204: noContent, ...errors },
      },
    },
    async (request, reply) => {
      await social.markNudgesSeen(app.db, scopedUserId(request));
      return reply.status(204).send(null);
    },
  );
};

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { apiErrorSchema, audioParamsSchema, emptyQuerySchema, z } from '@manabi/core';
import { audioClip } from './service';

export const mediaRoutes: FastifyPluginAsyncZod = async (app) => {
  // FR-131: generated on first play, then served from the media volume. A 503 tells the client to
  // use the device voice instead (NFR-23).
  app.get(
    '/media/audio/:ownerType/:ownerId',
    {
      schema: {
        summary: 'Ogg Opus clip of an item or sentence, generated on first request',
        tags: ['media'],
        params: audioParamsSchema,
        querystring: emptyQuerySchema,
        // The body is the Ogg file; Fastify sends a Buffer as is, unserialized.
        response: { 200: z.unknown(), 404: apiErrorSchema, 503: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const clip = await audioClip({
        db: app.db,
        tts: app.tts,
        mediaDir: app.config.mediaDir,
        log: request.log,
        ...request.params,
      });
      // The URL stays the same when the reading changes, so the browser revalidates each play.
      return reply.type('audio/ogg').header('cache-control', 'private, no-cache').send(clip);
    },
  );
};

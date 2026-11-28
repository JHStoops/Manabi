import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  apiErrorSchema,
  AUDIO_UPLOAD_MAX_BYTES,
  AUDIO_UPLOAD_TYPES,
  audioParamsSchema,
  authoringAudioParamsSchema,
  authoringAudioStatusSchema,
  emptyQuerySchema,
  strokeDataSchema,
  strokeItemKeyParamsSchema,
  z,
} from '@manabi/core';
import { requireAuth } from '../auth/guard';
import {
  readClip,
  getStrokes,
  removeUpload,
  resolveClip,
  uploadClip,
  uploadStatus,
} from './service';

/** RFC 9110 If-None-Match: `*` or a list of tags, weak ones (W/) compared weakly. */
function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header.split(',').some((tag) => {
    const t = tag.trim();
    return t === '*' || t.replace(/^W\//, '') === etag;
  });
}

const authoringErrors = {
  400: apiErrorSchema,
  401: apiErrorSchema,
  403: apiErrorSchema,
  404: apiErrorSchema,
  413: apiErrorSchema,
};

export const mediaRoutes: FastifyPluginAsyncZod = async (app) => {
  // FR-132, SDD section 11 (Uploads): a recording is sent as the raw request body with its audio
  // type, up to the size cap. Only this module reads audio bodies; any other type is refused
  // (415) before the handler runs. The service checks the bytes themselves.
  app.addContentTypeParser(
    [...AUDIO_UPLOAD_TYPES],
    { parseAs: 'buffer', bodyLimit: AUDIO_UPLOAD_MAX_BYTES },
    (_request, body, done) => done(null, body),
  );

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
        response: { 200: z.unknown(), 304: z.unknown(), 404: apiErrorSchema, 503: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const clip = await resolveClip({
        db: app.db,
        tts: app.tts,
        mediaDir: app.config.mediaDir,
        log: request.log,
        ...request.params,
      });
      // #66: the browser keeps the clip and revalidates it on every play, as the URL stays the
      // same when a reading changes or an author uploads a recording; an unchanged clip costs a
      // 304 with no body. `private`: clips are only for signed-in users.
      reply.header('cache-control', 'private, no-cache').header('etag', clip.etag);
      if (etagMatches(request.headers['if-none-match'], clip.etag)) {
        return reply.code(304).send();
      }
      return reply.type('audio/ogg').send(await readClip(app.config.mediaDir, clip.path));
    },
  );

  // FR-071, FR-077: Hanzi Writer character data, fetched by the stroke canvas's data loader.
  app.get(
    '/media/strokes/:itemKey',
    {
      schema: {
        summary: "A kanji's or kana's stroke data (an outline and a median per stroke)",
        tags: ['media'],
        querystring: emptyQuerySchema,
        params: strokeItemKeyParamsSchema,
        response: {
          200: strokeDataSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          404: apiErrorSchema,
        },
      },
    },
    async (request) => {
      requireAuth(request);
      return getStrokes(app.db, request.params.itemKey);
    },
  );

  // FR-132: the admin-only authoring routes (the guard checks the role for /authoring).
  app.get(
    '/authoring/audio/:ownerType/:ownerId',
    {
      schema: {
        summary: 'Whether an item or sentence has an uploaded recording, and whether it is current',
        tags: ['authoring'],
        params: authoringAudioParamsSchema,
        querystring: emptyQuerySchema,
        response: { 200: authoringAudioStatusSchema, ...authoringErrors },
      },
    },
    async (request) => uploadStatus(app.db, request.params.ownerType, request.params.ownerId),
  );

  app.put(
    '/authoring/audio/:ownerType/:ownerId',
    {
      schema: {
        summary: `Upload a recording (${AUDIO_UPLOAD_TYPES.join(', ')}; at most 5 MB) that replaces the generated clip`,
        tags: ['authoring'],
        params: authoringAudioParamsSchema,
        querystring: emptyQuerySchema,
        // The raw audio bytes, parsed as a Buffer by the content type parser above.
        body: z.instanceof(Buffer),
        response: { 200: authoringAudioStatusSchema, ...authoringErrors },
      },
    },
    async (request) => uploadClip(app.db, app.config.mediaDir, request.params, request.body),
  );

  app.delete(
    '/authoring/audio/:ownerType/:ownerId',
    {
      schema: {
        summary: 'Remove an uploaded recording, so the generated clip plays again',
        tags: ['authoring'],
        params: authoringAudioParamsSchema,
        querystring: emptyQuerySchema,
        response: { 200: authoringAudioStatusSchema, ...authoringErrors },
      },
    },
    async (request) => removeUpload(app.db, app.config.mediaDir, request.params),
  );
};

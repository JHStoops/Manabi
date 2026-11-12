import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { errorCodeForStatus } from '@manabi/core';
import type { ApiError } from '@manabi/core';
import type { Config } from './config';

/** Builds the Fastify app. Does not listen and does not connect to the database. */
export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.nodeEnv !== 'test' });

  app.setErrorHandler((error, _request, reply) => {
    const err = error as { statusCode?: number; message: string };
    const status = err.statusCode ?? 500;
    const body: ApiError = {
      error: {
        // IF-07: only codes from the core enum; framework codes (FST_ERR_*) are not exposed.
        code: errorCodeForStatus(status),
        message: status >= 500 ? 'Internal server error' : err.message,
        details: null,
      },
    };
    if (status >= 500) app.log.error(error);
    return reply.status(status).send(body);
  });

  app.get('/api/v1/healthz', async () => ({ status: 'ok' }));

  // PLACEHOLDER: the real document will be generated from the Zod schemas in @manabi/core.
  app.get('/api/v1/openapi.json', async () => ({
    openapi: '3.1.0',
    info: { title: 'Manabi API', version: '0.0.0' },
    paths: {
      '/api/v1/healthz': {
        get: { responses: { '200': { description: 'Service is healthy' } } },
      },
    },
  }));

  if (config.webDistDir && existsSync(config.webDistDir)) {
    await app.register(fastifyStatic, { root: config.webDistDir });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        const body: ApiError = {
          error: { code: 'not_found', message: 'Route not found', details: null },
        };
        return reply.status(404).send(body);
      }
      if (existsSync(join(config.webDistDir, 'index.html'))) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send();
    });
  }

  return app;
}

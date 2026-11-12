import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Writable } from 'node:stream';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest, FastifyServerOptions } from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { FastifyPluginAsyncZod, ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Pool } from 'pg';
import { emptyQuerySchema } from '@manabi/core';
import type { Config, TrustProxy } from './config';
import { apiNotFound, errorHandler } from './errors';
import { jobNames } from './jobs';
import { createJobQueue } from './jobs/queue';
import { REDACT_PATHS } from './logger';
import { featureModules } from './modules';
import { API_PREFIX, missingRequestSchemas } from './routeSchemas';
import type { RegisteredRoute } from './types';
import './types';

export interface AppOptions {
  config: Config;
  /** The shared pg pool; the caller owns it and ends it after closing the app. */
  pool: Pool;
  /** Where JSON logs go instead of stdout (tests). */
  logStream?: Writable;
}

/**
 * Structured JSON logs to stdout (SDD section 12). Requests are logged by method, path and route
 * only: no query strings (they can hold search terms), client addresses or headers.
 */
function loggerOptions(config: Config, stream?: Writable): FastifyServerOptions['logger'] {
  return {
    level: config.logLevel,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    serializers: {
      req: (request: FastifyRequest) => ({
        id: request.id,
        method: request.method,
        path: request.url.split('?')[0],
        route: request.routeOptions?.url,
      }),
    },
    ...(stream ? { stream } : {}),
  };
}

/**
 * SDD section 11 (Headers): strict CSP, HSTS, no-sniff and frame-deny on every response. The web
 * app makes no third-party requests, so everything is same-origin. Emotion injects <style> tags
 * at runtime, hence 'unsafe-inline' for styles only.
 */
function helmetOptions(config: Config) {
  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        manifestSrc: ["'self'"],
        mediaSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        workerSrc: ["'self'"],
        // Production is reached over HTTPS through Nginx Proxy Manager. Elsewhere, and for
        // troubleshooting at http://<lxc-ip>:3000, plain http must keep working.
        upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
      },
    },
    strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    frameguard: { action: 'deny' as const },
  };
}

/**
 * IF-08: Fastify's own handling of a numeric trustProxy trusts nothing, so a hop count becomes a
 * function: the first `hops` addresses (the socket peer, then right-most X-Forwarded-For entries)
 * are proxies; request.ip is the next one, which a client cannot forge by prepending entries.
 */
function fastifyTrustProxy(
  trust: TrustProxy,
): boolean | string[] | ((a: string, hop: number) => boolean) {
  if (typeof trust === 'number') return (_address, hop) => hop < trust;
  return trust;
}

/** The OpenAPI document of every API route (IF-05). */
const openApiRoute: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/openapi.json',
    {
      schema: {
        summary: 'OpenAPI description of this API',
        tags: ['meta'],
        querystring: emptyQuerySchema,
      },
    },
    async () => app.swagger(),
  );
};

/**
 * Builds the Fastify app. Does not listen. Every route under /api/v1 must declare its request
 * schemas (NFR-13); registering one without them fails here, at start-up.
 */
export async function buildApp({ config, pool, logStream }: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.logLevel === 'silent' && !logStream ? false : loggerOptions(config, logStream),
    // IF-08: Nginx Proxy Manager terminates HTTPS and sets X-Forwarded-For/-Proto/-Host, so
    // request.protocol is 'https' and request.ip is the client's for proxied requests.
    trustProxy: fastifyTrustProxy(config.trustProxy),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('db', pool);
  // NFR-23: jobs go into the pg-boss tables; the API never works them, so it keeps serving
  // whether or not the worker runs. The queue connects on first use and closes with the app.
  const jobs = createJobQueue({
    databaseUrl: config.databaseUrl,
    queueNames: jobNames,
    log: app.log,
  });
  app.decorate('jobs', jobs);
  app.addHook('onClose', () => jobs.stop());

  const routes: RegisteredRoute[] = [];
  app.decorate('registeredRoutes', routes);
  app.addHook('onRoute', (route) => {
    const missing = missingRequestSchemas(route);
    if (missing.length > 0) {
      throw new Error(
        `Route ${String(route.method)} ${route.url} must declare Zod schemas for: ${missing.join(', ')} (NFR-13)`,
      );
    }
    routes.push({ method: route.method, url: route.url, schema: route.schema });
  });

  await app.register(fastifyHelmet, helmetOptions(config));
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'Manabi API', version: '1.0.0' },
    },
    transform: jsonSchemaTransform,
  });

  app.setErrorHandler(errorHandler);

  await app.register(
    async (api) => {
      for (const module of featureModules) await api.register(module);
      await api.register(openApiRoute);
    },
    { prefix: API_PREFIX },
  );

  const hasWebApp = Boolean(config.webDistDir) && existsSync(config.webDistDir);
  if (hasWebApp) {
    await app.register(fastifyStatic, { root: config.webDistDir });
  }
  app.setNotFoundHandler((request, reply) => {
    // The web app does its own routing: unknown non-API paths get index.html.
    if (
      hasWebApp &&
      !request.url.startsWith('/api/') &&
      existsSync(join(config.webDistDir, 'index.html'))
    ) {
      return reply.sendFile('index.html');
    }
    return apiNotFound(request, reply);
  });

  return app;
}

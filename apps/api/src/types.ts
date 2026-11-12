import type { FastifySchema, HTTPMethods } from 'fastify';
import type { Pool } from 'pg';
import type { JobQueue } from './jobs/queue';

/** A route as registered, recorded by `buildApp` for the schema and OpenAPI checks. */
export interface RegisteredRoute {
  method: HTTPMethods | HTTPMethods[];
  url: string;
  schema?: FastifySchema;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** The shared pg pool. Only `queries.ts` files run SQL on it. */
    db: Pool;
    /** Enqueues background jobs for the worker; never throws or blocks a request for long. */
    jobs: JobQueue;
    /** Every route registered on this app, in registration order. */
    registeredRoutes: RegisteredRoute[];
  }
}

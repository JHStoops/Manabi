import type { FastifySchema, HTTPMethods } from 'fastify';
import type { Pool } from 'pg';
import type { Role } from '@manabi/core';
import type { Config } from './config';
import type { JobQueue } from './jobs/queue';
import type { AuthContext } from './modules/auth/service';
import type { AttemptLimiter } from './rateLimit';

/** A route as registered, recorded by `buildApp` for the schema and OpenAPI checks. */
export interface RegisteredRoute {
  method: HTTPMethods | HTTPMethods[];
  url: string;
  schema?: FastifySchema;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** The configuration the app was built with. */
    config: Config;
    /** The shared pg pool. Only `queries.ts` files run SQL on it. */
    db: Pool;
    /** Enqueues background jobs for the worker; never throws or blocks a request for long. */
    jobs: JobQueue;
    /** Every route registered on this app, in registration order. */
    registeredRoutes: RegisteredRoute[];
    /** NFR-12: attempt counters for the sign-in, invite and password routes. */
    attemptLimiter: AttemptLimiter;
  }

  interface FastifyRequest {
    /** The signed-in caller; set by the auth guard on every private /api/v1 route. */
    auth: AuthContext | null;
  }

  /** Per-route options read by the auth guard (modules/auth/guard.ts). */
  interface FastifyContextConfig {
    /** Reachable without signing in (health, OpenAPI, sign-in, accept-invite). */
    public?: boolean;
    /** Usable by a session that must change its password first (FR-005). */
    allowPasswordChangeRequired?: boolean;
    /** Role needed beyond the route group's default (FR-006). */
    role?: Role;
  }
}

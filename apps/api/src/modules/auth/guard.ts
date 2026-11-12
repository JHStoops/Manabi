import type { FastifyReply, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { opaqueTokenSchema } from '@manabi/core';
import type { Role } from '@manabi/core';
import type { Config } from '../../config';
import { AppError } from '../../errors';
import { API_PREFIX } from '../../routeSchemas';
import type { AuthContext, IssuedSession, ScopedUserId } from './service';
import { authenticate, SESSION_TTL_DAYS } from './service';

/**
 * HTTP side of authentication (SDD section 11, IF-06): reading the session token from the
 * cookie or the bearer header, the Origin check, the per-route-group role guard and the session
 * cookie itself. Business rules and SQL stay in service.ts and queries.ts.
 */

export const SESSION_COOKIE = 'manabi_session';

/** Route groups that need an admin (FR-006, SDD section 8): admin console and authoring. */
const ADMIN_PREFIXES = [`${API_PREFIX}/admin`, `${API_PREFIX}/authoring`];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function inGroup(url: string, prefix: string): boolean {
  return url === prefix || url.startsWith(`${prefix}/`);
}

/** The role a route needs: its own `config.role`, else admin for the admin route groups. */
export function requiredRole(url: string, configured?: Role): Role | undefined {
  if (configured) return configured;
  return ADMIN_PREFIXES.some((p) => inGroup(url, p)) ? 'admin' : undefined;
}

type TokenSource = { token: string; via: 'bearer' | 'cookie' } | null;

/**
 * IF-06: a bearer header wins over the cookie. A malformed token counts as present (so the
 * request is refused rather than treated as anonymous) but can never match a session.
 */
function readToken(request: FastifyRequest): TokenSource {
  const header = request.headers.authorization;
  if (header !== undefined) {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
    return { token: match?.[1] ?? '', via: 'bearer' };
  }
  const cookie = request.cookies[SESSION_COOKIE];
  return cookie ? { token: cookie, via: 'cookie' } : null;
}

/**
 * SDD section 11: a state-changing request must come from the app's own origin when it rides on
 * the session cookie. Any request that does carry an Origin must match too, which also stops
 * cross-site sign-in forms. Bearer requests without Origin (mobile clients) pass: a browser
 * cannot attach a bearer token cross-site without CORS, which the API does not enable.
 * Outside production the request's own origin is accepted too, for the Vite dev proxy.
 */
function checkOrigin(request: FastifyRequest, config: Config, via: 'bearer' | 'cookie' | null) {
  if (SAFE_METHODS.has(request.method)) return;
  const origin = request.headers.origin;
  if (origin === undefined) {
    if (via === 'cookie') throw new AppError('forbidden', 'Missing Origin header');
    return;
  }
  const allowed = new Set([new URL(config.publicUrl).origin]);
  if (config.nodeEnv !== 'production') allowed.add(`${request.protocol}://${request.host}`);
  if (!allowed.has(origin)) throw new AppError('forbidden', 'Cross-origin request refused');
}

/** NFR-11: HttpOnly, SameSite=Lax and Secure. */
function cookieOptions(request: FastifyRequest, maxAgeSeconds: number) {
  return {
    path: API_PREFIX,
    httpOnly: true,
    sameSite: 'lax' as const,
    // Always in production (NFR-11), even if a proxy forgot X-Forwarded-Proto; elsewhere only
    // over HTTPS, so http://localhost development keeps working.
    secure: request.server.config.nodeEnv === 'production' || request.protocol === 'https',
    maxAge: maxAgeSeconds,
  };
}

export function setSessionCookie(request: FastifyRequest, reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, cookieOptions(request, SESSION_TTL_DAYS * 24 * 60 * 60));
}

export function clearSessionCookie(request: FastifyRequest, reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, cookieOptions(request, 0));
}

/**
 * IF-06: hands a new session to the client. Web clients get the HttpOnly cookie and never see
 * the token; other clients get it in the body for the Authorization header.
 */
export function deliverSession(
  request: FastifyRequest,
  reply: FastifyReply,
  issued: IssuedSession,
): { user: IssuedSession['user']; token?: string } {
  if (issued.clientKind === 'web') {
    setSessionCookie(request, reply, issued.token);
    return { user: issued.user };
  }
  return { user: issued.user, token: issued.token };
}

/**
 * The guard on every /api/v1 route (FR-006). Routes are private unless `config.public` is set.
 * A session whose account must change its password may only use routes marked
 * `config.allowPasswordChangeRequired` (FR-005). Admin route groups need the admin role.
 */
export function authGuard(config: Config): onRequestAsyncHookHandler {
  return async function guard(request, reply) {
    const url = request.routeOptions.url;
    // Unknown routes get their 404; static web files are not the API's.
    if (!url || !inGroup(url, API_PREFIX)) return;
    const routeConfig = request.routeOptions.config;

    const source = readToken(request);
    checkOrigin(request, config, source?.via ?? null);
    if (routeConfig.public) return;

    const found =
      source && opaqueTokenSchema.safeParse(source.token).success
        ? await authenticate(request.server.db, source.token)
        : null;
    if (!found) {
      if (source?.via === 'cookie') clearSessionCookie(request, reply);
      throw new AppError('unauthenticated', 'Sign in to continue');
    }
    request.auth = found.context;
    // FR-003: the cookie's lifetime slides with the session's.
    if (found.renewedUntil && source?.via === 'cookie') {
      setSessionCookie(request, reply, source.token);
    }

    const { user } = found.context;
    if (user.must_change_password && !routeConfig.allowPasswordChangeRequired) {
      throw new AppError('password_change_required', 'Choose a new password to continue');
    }
    const role = requiredRole(url, routeConfig.role);
    if (role && user.role !== role) {
      throw new AppError('forbidden', 'This needs an admin account');
    }
  };
}

/** The signed-in caller of a private route. */
export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw new AppError('unauthenticated', 'Sign in to continue');
  return request.auth;
}

/** NFR-14: the caller's own user id, the only id a per-user service may act on. */
export function scopedUserId(request: FastifyRequest): ScopedUserId {
  return requireAuth(request).userId;
}

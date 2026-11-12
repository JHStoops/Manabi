import type { RouteOptions } from 'fastify';

/** Every API route lives under this prefix (IF-04). */
export const API_PREFIX = '/api/v1';

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

function methodsOf(route: Pick<RouteOptions, 'method'>): string[] {
  return (Array.isArray(route.method) ? route.method : [route.method]).map((m) => m.toUpperCase());
}

/**
 * NFR-13: which request schemas an API route is missing. Every route declares a query schema;
 * a route with path parameters declares a params schema; POST, PUT and PATCH declare a body
 * schema. Routes outside /api/v1 (static web files) are not checked.
 */
export function missingRequestSchemas(
  route: Pick<RouteOptions, 'method' | 'url' | 'schema'>,
): string[] {
  if (!route.url.startsWith(API_PREFIX)) return [];
  const schema = route.schema ?? {};
  const missing: string[] = [];
  if (!schema.querystring) missing.push('querystring');
  if (route.url.includes(':') && !schema.params) missing.push('params');
  if (methodsOf(route).some((m) => METHODS_WITH_BODY.has(m)) && !schema.body) missing.push('body');
  return missing;
}

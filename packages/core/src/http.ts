import { z } from 'zod';

/**
 * NFR-13: every route declares a query schema. Routes that take no query parameters use this
 * one; unknown parameters are dropped rather than reaching the handler.
 */
export const emptyQuerySchema = z.object({});
export type EmptyQuery = z.infer<typeof emptyQuerySchema>;

/**
 * NFR-13: the body schema of a POST that takes no input, such as sign-out. The body may be left
 * out or be an empty JSON object.
 */
export const emptyBodySchema = z.object({}).nullish();

/**
 * FR-052, SDD section 8: headers of a write that awards progress. A retry carrying the same
 * Idempotency-Key gets the first response instead of being applied again. Other headers pass.
 */
export const idempotencyHeadersSchema = z.looseObject({
  'idempotency-key': z
    .string()
    .regex(/^[\x21-\x7e]{1,255}$/, 'Use 1 to 255 visible ASCII characters')
    .optional(),
});

/**
 * FR-163: the device's IANA time zone, sent by the API client on every call. The server keeps the
 * learner's last-seen zone from it and ignores names its database does not know.
 */
export const TIME_ZONE_HEADER = 'X-Time-Zone';

/** FR-203: status of one dependency in the health report. */
export const healthStatusSchema = z.enum(['ok', 'unavailable']);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

/** FR-203: body of `GET /api/v1/healthz` when the API and its database are both up. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  api: z.literal('ok'),
  database: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * FR-203: `details` of the `service_unavailable` error that `GET /api/v1/healthz` returns with
 * 503 when a dependency is down. The error keeps the one API error shape (IF-07).
 */
export const healthDetailsSchema = z.object({
  api: healthStatusSchema,
  database: healthStatusSchema,
});
export type HealthDetails = z.infer<typeof healthDetailsSchema>;

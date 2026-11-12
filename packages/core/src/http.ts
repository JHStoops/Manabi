import { z } from 'zod';

/**
 * NFR-13: every route declares a query schema. Routes that take no query parameters use this
 * one; unknown parameters are dropped rather than reaching the handler.
 */
export const emptyQuerySchema = z.object({});
export type EmptyQuery = z.infer<typeof emptyQuerySchema>;

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

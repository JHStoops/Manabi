import { z } from 'zod';

/**
 * IF-07: machine-readable error codes. Every error response carries exactly one of these, sent
 * with the HTTP status from `errorStatus`.
 */
export const errorCodeSchema = z.enum([
  'bad_request',
  'validation_failed',
  'unauthenticated',
  'password_change_required',
  'forbidden',
  'not_found',
  'conflict',
  'idempotency_conflict',
  'payload_too_large',
  'rate_limited',
  'internal_error',
  'service_unavailable',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** The HTTP status sent with each error code. */
export const errorStatus: Readonly<Record<ErrorCode, number>> = {
  bad_request: 400,
  // NFR-13: the request failed schema validation; `details` carries the issues.
  validation_failed: 400,
  unauthenticated: 401,
  // FR-005: signed in with a temporary password that must be changed first.
  password_change_required: 403,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  // An Idempotency-Key was reused with a different request (SDD section 8).
  idempotency_conflict: 409,
  payload_too_large: 413,
  // NFR-12.
  rate_limited: 429,
  internal_error: 500,
  service_unavailable: 503,
};

/** The generic code for an HTTP status, for errors raised without one (framework errors). */
export function errorCodeForStatus(status: number): ErrorCode {
  switch (status) {
    case 401:
      return 'unauthenticated';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 413:
      return 'payload_too_large';
    case 429:
      return 'rate_limited';
    case 503:
      return 'service_unavailable';
    default:
      return status >= 500 ? 'internal_error' : 'bad_request';
  }
}

/** The single error shape returned by every API endpoint: `{ error: { code, message, details } }`. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

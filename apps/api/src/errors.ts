import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { errorCodeForStatus, errorStatus } from '@manabi/core';
import type { ApiError, ErrorCode } from '@manabi/core';

/**
 * An error a service or route raises on purpose, such as `new AppError('not_found', 'Course not
 * found')`. It is sent with the status for its code and its message and details as given, so the
 * message must be safe to show to the client.
 */
export class AppError extends Error {
  override name = 'AppError';
  readonly statusCode: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
    this.statusCode = errorStatus[code];
  }
}

/** One schema problem in a `validation_failed` error's `details` (NFR-13). */
export interface ValidationIssue {
  /** Which part of the request failed: body, querystring, params or headers. */
  location: string;
  /** Path to the field inside that part; empty for the part as a whole. */
  path: (string | number)[];
  message: string;
}

function body(code: ErrorCode, message: string, details: unknown = null): ApiError {
  return { error: { code, message, details } };
}

function validationIssues(error: FastifyError): ValidationIssue[] {
  const location = error.validationContext ?? 'request';
  if (hasZodFastifySchemaValidationErrors(error)) {
    return error.validation.map((v) => ({
      location,
      path: v.params.issue.path,
      message: v.params.issue.message,
    }));
  }
  // Validation by a non-Zod schema (none are registered, but Fastify's own checks use AJV shapes).
  return (error.validation ?? []).map((v) => ({
    location,
    path: v.instancePath.split('/').filter(Boolean),
    message: v.message ?? 'Invalid value',
  }));
}

/**
 * IF-07: turns every error into `{ error: { code, message, details } }` with a code from the core
 * enum. Framework codes (FST_ERR_*) are not exposed, and 5xx responses never carry internals.
 */
export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) request.log.error({ err: error }, 'Request failed');
    // NFR-12: a rate-limited client learns when to try again.
    const retryAfter = (error.details as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds;
    if (error.code === 'rate_limited' && typeof retryAfter === 'number') {
      reply.header('retry-after', String(retryAfter));
    }
    return reply.status(error.statusCode).send(body(error.code, error.message, error.details));
  }

  const err = error as FastifyError;
  // NFR-13: a request that fails its schema gets every issue, by field.
  if (err.validation) {
    return reply
      .status(400)
      .send(body('validation_failed', 'Request validation failed', validationIssues(err)));
  }

  const status = err.statusCode ?? 500;
  if (status < 400 || status >= 500 || isResponseSerializationError(err)) {
    request.log.error({ err }, 'Request failed');
    if (status === 503) {
      return reply.status(503).send(body('service_unavailable', 'Service unavailable'));
    }
    return reply.status(500).send(body('internal_error', 'Internal server error'));
  }
  // Framework 4xx errors (malformed JSON, body too large, ...) carry client-safe messages.
  return reply.status(status).send(body(errorCodeForStatus(status), err.message));
}

/** IF-07: unknown routes under /api answer 404 in the shared shape. */
export function apiNotFound(_request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return reply.status(404).send(body('not_found', 'Route not found'));
}

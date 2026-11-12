import type { Writable } from 'node:stream';
import pino from 'pino';
import type { BaseLogger } from 'pino';
import type { Config } from './config';

/** Log fields that could carry secrets; pino replaces their values. Shared by API and worker. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  'newPassword',
  '*.newPassword',
  'currentPassword',
  '*.currentPassword',
  'token',
  '*.token',
  'sessionSecret',
  '*.sessionSecret',
  'databaseUrl',
  '*.databaseUrl',
  // pg's DatabaseError.detail quotes row values, e.g. "Key (email)=(a@b.c) already exists".
  'err.detail',
];

/** What job code needs from a logger; both pino and Fastify's `app.log` satisfy it. */
export type Logger = Pick<BaseLogger, 'info' | 'warn' | 'error' | 'debug'>;

/**
 * Structured JSON logs to stdout for processes other than the API (the worker), with the same
 * level and redaction as the API's request logger (SDD section 12).
 */
export function createLogger(
  config: Pick<Config, 'logLevel'>,
  base: Record<string, unknown> = {},
  stream?: Writable,
): pino.Logger {
  const options = {
    level: config.logLevel,
    base: { pid: process.pid, ...base },
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  };
  return stream ? pino(options, stream) : pino(options);
}

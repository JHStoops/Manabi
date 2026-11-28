import { z } from 'zod';
import type { CardDensity } from '@manabi/core';
import { DEFAULT_SRS_INTERVAL_HOURS, levelCodeSchema } from '@manabi/core';

export type NodeEnv = 'development' | 'test' | 'production';

/**
 * Which proxies may set X-Forwarded-* (IF-08), in Fastify's `trustProxy` form: `true` trusts any
 * peer, `false` none, a number trusts that many hops (the default, 1, is Nginx Proxy Manager
 * itself), a list trusts those addresses, CIDR ranges or proxy-addr names (loopback, linklocal,
 * uniquelocal).
 */
export type TrustProxy = boolean | number | string[];

const PROXY_ADDR_NAMES = new Set(['loopback', 'linklocal', 'uniquelocal']);

export interface Config {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  publicUrl: string;
  databaseUrl: string;
  sessionSecret: string;
  /** Folder for user-visible media (audio, images); may be a separate HDD mount. */
  mediaDir: string;
  /** IF-09: base URL of the Kokoro-FastAPI TTS engine, on the internal network only. */
  ttsUrl: string;
  /** Built web app to serve; empty string disables static serving (dev mode). */
  webDistDir: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  trustProxy: TrustProxy;
  /** Highest level the level-list import reads (SDD section 10 step 2); raise it to add a level. */
  levelCeiling: string;
  /** FR-111: hours until the next review at SRS stages 1 to 7. */
  srsIntervalHours: number[];
  /** FR-041 (#256): the most teaching cards per exercises in a lesson session (3 per 5). */
  lessonCardDensity: CardDensity;
  /**
   * FR-041 (#256): an item from an earlier lesson gets a refresher card when the learner's lowest
   * SRS stage on it is at most this (1 to 7; 0 turns refreshers off).
   */
  refresherMaxStage: number;
  /** Folder of downloaded open datasets; admin-started imports only read files inside it. */
  datasetsDir: string;
  /** IF-10: the only way email leaves the server; null when SMTP_HOST is unset (no email). */
  smtp: SmtpConfig | null;
}

export interface SmtpConfig {
  host: string;
  port: number;
  /** Empty when the server needs no sign-in. */
  user: string;
  password: string;
  /** The From address of every email. */
  from: string;
}

/** Thrown by `loadConfig` when the environment is invalid. The message never contains values. */
export class ConfigError extends Error {
  override name = 'ConfigError';
}

const optionalText = z
  .string()
  .optional()
  .transform((v) => v ?? '');

const trustProxySchema = z
  .string()
  .trim()
  .min(1)
  .transform((value, ctx): TrustProxy => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^\d+$/.test(value)) return Number(value);
    const list = value.split(',').map((s) => s.trim());
    const valid = (s: string) => PROXY_ADDR_NAMES.has(s) || /^[0-9a-fA-F:.]+(\/\d{1,3})?$/.test(s);
    if (!list.every(valid)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Expected true, false, a hop count, or comma-separated IP addresses, CIDR ranges, ' +
          'loopback, linklocal or uniquelocal',
      });
      return z.NEVER;
    }
    return list;
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    PUBLIC_URL: z.string().url().default('http://localhost:3000'),
    DATABASE_URL: z
      .string()
      .optional()
      .refine((v) => !v || /^postgres(ql)?:\/\//.test(v), {
        message: 'Expected a postgres:// connection URL',
      }),
    SESSION_SECRET: optionalText,
    MEDIA_DIR: z.string().min(1).default('./media'),
    TTS_URL: z.string().url().default('http://localhost:8880'),
    WEB_DIST_DIR: optionalText,
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    // IF-08: by default trust one hop, Nginx Proxy Manager, so request.ip is the address it saw
    // and clients cannot spoof it with their own X-Forwarded-For. Setting NPM's address instead
    // also stops other LAN peers from faking X-Forwarded-Proto.
    TRUST_PROXY: trustProxySchema.prefault('1'),
    LEVEL_CEILING: levelCodeSchema.default('N3'),
    DATASETS_DIR: z.string().min(1).default('./datasets'),
    // FR-111: the review ladder's intervals, tunable without code changes.
    SRS_INTERVAL_HOURS: z
      .string()
      .default(DEFAULT_SRS_INTERVAL_HOURS.join(','))
      .transform((v) => v.split(',').map((h) => Number(h.trim())))
      .refine((hours) => hours.length === 7 && hours.every((h) => Number.isFinite(h) && h > 0), {
        message: 'Expected 7 comma-separated positive hours, one per stage 1 to 7',
      }),
    // FR-041 (#256): "cards/exercises", up to 3 cards for every 5 to 7 exercises.
    LESSON_CARDS_PER_EXERCISES: z
      .string()
      .default('3/5')
      .transform((v) => v.split('/').map((n) => Number(n.trim())))
      .refine(
        (parts) =>
          parts.length === 2 && parts.every((n) => Number.isInteger(n) && n >= 0) && parts[1]! > 0,
        { message: 'Expected "cards/exercises", such as 3/5' },
      )
      .transform(([cards, exercises]) => ({ cards: cards!, exercises: exercises! })),
    REFRESHER_MAX_STAGE: z.coerce.number().int().min(0).max(7).default(4),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    SMTP_FROM: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // Tests that need a database get their own URL; everything else needs one to start.
    if (env.NODE_ENV !== 'test' && !env.DATABASE_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'Required' });
    }
    if (env.SMTP_HOST && !env.SMTP_FROM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_FROM'],
        message: 'Required when SMTP_HOST is set',
      });
    }
    if (env.NODE_ENV === 'production') {
      if (env.SESSION_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'Required in production: at least 32 characters (openssl rand -hex 32)',
        });
      }
      // NFR-11: all traffic uses HTTPS, terminated by Nginx Proxy Manager.
      if (!env.PUBLIC_URL.startsWith('https://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PUBLIC_URL'],
          message: 'Must be an https:// URL in production',
        });
      }
    }
  });

/**
 * Reads and validates configuration from environment variables. Throws a `ConfigError` naming
 * every invalid variable, so the process fails fast at start-up with a clear message.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // An empty variable (`LOG_LEVEL=` in the .env file) means "not set".
  const set = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v !== ''),
  );
  const parsed = envSchema.safeParse(set);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new ConfigError(`Invalid configuration:\n${lines.join('\n')}`);
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    publicUrl: e.PUBLIC_URL,
    databaseUrl: e.DATABASE_URL ?? '',
    sessionSecret: e.SESSION_SECRET,
    mediaDir: e.MEDIA_DIR,
    ttsUrl: e.TTS_URL,
    webDistDir: e.WEB_DIST_DIR,
    logLevel: e.LOG_LEVEL ?? (e.NODE_ENV === 'test' ? 'silent' : 'info'),
    trustProxy: e.TRUST_PROXY,
    levelCeiling: e.LEVEL_CEILING,
    datasetsDir: e.DATASETS_DIR,
    srsIntervalHours: e.SRS_INTERVAL_HOURS,
    lessonCardDensity: e.LESSON_CARDS_PER_EXERCISES,
    refresherMaxStage: e.REFRESHER_MAX_STAGE,
    smtp: e.SMTP_HOST
      ? {
          host: e.SMTP_HOST,
          port: e.SMTP_PORT,
          user: e.SMTP_USER,
          password: e.SMTP_PASSWORD,
          from: e.SMTP_FROM ?? '',
        }
      : null,
  };
}

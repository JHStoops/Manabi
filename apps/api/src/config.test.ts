import { FixedLadderScheduler } from '@manabi/core';
import { ConfigError, loadConfig } from './config';

const DB = 'postgres://manabi:pw@db:5432/manabi';
const SECRET = 'a'.repeat(64);

describe('loadConfig', () => {
  it('fills defaults', () => {
    expect(loadConfig({ NODE_ENV: 'test' })).toEqual({
      nodeEnv: 'test',
      host: '0.0.0.0',
      port: 3000,
      publicUrl: 'http://localhost:3000',
      databaseUrl: '',
      sessionSecret: '',
      mediaDir: './media',
      ttsUrl: 'http://localhost:8880',
      webDistDir: '',
      logLevel: 'silent',
      trustProxy: 1,
      levelCeiling: 'N3',
      datasetsDir: './datasets',
      srsIntervalHours: [4, 24, 72, 168, 336, 720, 2880],
      lessonCardDensity: { cards: 3, exercises: 5 },
      refresherMaxStage: 4,
      smtp: null,
    });
  });

  it('reads SMTP settings and needs a From address with a host (IF-10)', () => {
    expect(
      loadConfig({ NODE_ENV: 'test', SMTP_HOST: 'mail', SMTP_FROM: 'manabi@example.com' }).smtp,
    ).toEqual({ host: 'mail', port: 587, user: '', password: '', from: 'manabi@example.com' });
    expect(() => loadConfig({ NODE_ENV: 'test', SMTP_HOST: 'mail' })).toThrow(/SMTP_FROM/);
  });

  it('reads a production environment', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      PUBLIC_URL: 'https://manabi.example.com',
      DATABASE_URL: DB,
      SESSION_SECRET: SECRET,
      MEDIA_DIR: '/media',
      LOG_LEVEL: 'warn',
      LEVEL_CEILING: 'N2',
      SMTP_HOST: '',
    });
    expect(config).toMatchObject({
      nodeEnv: 'production',
      port: 8080,
      databaseUrl: DB,
      sessionSecret: SECRET,
      logLevel: 'warn',
      levelCeiling: 'N2',
    });
  });

  it('reads the lesson card density and refresher stage (FR-041, #256)', () => {
    expect(
      loadConfig({
        NODE_ENV: 'test',
        LESSON_CARDS_PER_EXERCISES: ' 3 / 7 ',
        REFRESHER_MAX_STAGE: '2',
      }),
    ).toMatchObject({ lessonCardDensity: { cards: 3, exercises: 7 }, refresherMaxStage: 2 });
  });

  it('changes review due times through SRS_INTERVAL_HOURS (FR-111)', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const { srsIntervalHours } = loadConfig({
      NODE_ENV: 'test',
      SRS_INTERVAL_HOURS: '4, 48, 72, 168, 336, 720, 2880',
    });
    expect(new FixedLadderScheduler(srsIntervalHours).next(1, true, now).dueAt).toEqual(
      new Date('2026-01-03T00:00:00Z'),
    );
  });

  it('defaults the log level to info outside tests and treats empty variables as unset', () => {
    expect(loadConfig({ DATABASE_URL: DB, LOG_LEVEL: '' }).logLevel).toBe('info');
  });

  it.each([
    ['true', true],
    ['1', 1],
    ['2', 2],
    ['loopback, uniquelocal', ['loopback', 'uniquelocal']],
    ['false', false],
    ['172.18.0.0/16', ['172.18.0.0/16']],
    ['10.0.0.2, ::1', ['10.0.0.2', '::1']],
  ])('parses TRUST_PROXY=%s', (value, expected) => {
    expect(loadConfig({ NODE_ENV: 'test', TRUST_PROXY: value }).trustProxy).toEqual(expected);
  });

  it.each([
    ['a missing database URL', { NODE_ENV: 'development' }, 'DATABASE_URL: Required'],
    ['a non-postgres database URL', { DATABASE_URL: 'mysql://x' }, 'DATABASE_URL'],
    ['a bad port', { NODE_ENV: 'test', PORT: '70000' }, 'PORT'],
    ['an unknown NODE_ENV', { NODE_ENV: 'staging' }, 'NODE_ENV'],
    ['a bad TRUST_PROXY', { NODE_ENV: 'test', TRUST_PROXY: 'npm-host' }, 'TRUST_PROXY'],
    ['too few SRS intervals', { NODE_ENV: 'test', SRS_INTERVAL_HOURS: '4,24' }, 'SRS_INTERVAL'],
    [
      'a zero SRS interval',
      { NODE_ENV: 'test', SRS_INTERVAL_HOURS: '0,1,2,3,4,5,6' },
      'SRS_INTERVAL',
    ],
    [
      'a bad card density',
      { NODE_ENV: 'test', LESSON_CARDS_PER_EXERCISES: '3/0' },
      'LESSON_CARDS_PER_EXERCISES',
    ],
    ['a bad refresher stage', { NODE_ENV: 'test', REFRESHER_MAX_STAGE: '9' }, 'REFRESHER_MAX'],
    ['a bad LEVEL_CEILING', { NODE_ENV: 'test', LEVEL_CEILING: 'N 2' }, 'LEVEL_CEILING'],
    [
      'a short production secret',
      { NODE_ENV: 'production', DATABASE_URL: DB, PUBLIC_URL: 'https://m.example.com' },
      'SESSION_SECRET',
    ],
    [
      'an http production URL',
      { NODE_ENV: 'production', DATABASE_URL: DB, SESSION_SECRET: SECRET, PUBLIC_URL: 'http://m' },
      'PUBLIC_URL: Must be an https:// URL in production',
    ],
  ])('fails fast on %s', (_label, env, message) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(message);
  });

  it('names every problem without echoing values', () => {
    let error: unknown;
    try {
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'mysql://root:hunter2@db',
        SESSION_SECRET: 'short-sekrit',
      });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const message = (error as Error).message;
    expect(message).toMatch(/^Invalid configuration:/);
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('SESSION_SECRET');
    expect(message).not.toContain('hunter2');
    expect(message).not.toContain('short-sekrit');
  });
});

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
      webDistDir: '',
      logLevel: 'silent',
      trustProxy: 1,
    });
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
      SMTP_HOST: '',
    });
    expect(config).toMatchObject({
      nodeEnv: 'production',
      port: 8080,
      databaseUrl: DB,
      sessionSecret: SECRET,
      logLevel: 'warn',
    });
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

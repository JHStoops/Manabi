import { Writable } from 'node:stream';
import { createLogger } from './logger';

function capture(): { stream: Writable; lines: () => Record<string, unknown>[] } {
  let out = '';
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      out += chunk.toString();
      callback();
    },
  });
  const lines = () =>
    out
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { stream, lines };
}

describe('createLogger', () => {
  it('writes JSON lines with the base fields and redacts secrets', () => {
    const { stream, lines } = capture();
    const log = createLogger({ logLevel: 'info' }, { service: 'worker' }, stream);

    log.info({ config: { databaseUrl: 'postgres://u:secret@db/x' }, token: 'abc' }, 'hello');

    const [line] = lines();
    expect(line).toMatchObject({
      level: 30,
      service: 'worker',
      msg: 'hello',
      token: '[redacted]',
      config: { databaseUrl: '[redacted]' },
    });
  });

  it('honors the configured level', () => {
    const { stream, lines } = capture();
    const log = createLogger({ logLevel: 'warn' }, {}, stream);
    log.info('dropped');
    log.warn('kept');
    expect(lines().map((l) => l.msg)).toEqual(['kept']);
  });
});

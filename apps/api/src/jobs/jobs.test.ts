import { createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import type { Logger } from '../logger';
import { query } from '../db/db';
import { DEAD_DATABASE_URL } from '../test/app';
import { describeWithDb, testDatabaseUrl, useTestDatabase } from '../test/db';
import { seedUser, tokenHash } from '../test/fixtures';
import { BOSS_SCHEMA } from './boss';
import { defineJob } from './define';
import { allJobs, jobNames } from './index';
import { purgeExpiredJob } from './purgeExpired';
import { createJobQueue } from './queue';
import type { JobQueue } from './queue';
import { startWorker } from './worker';
import type { RunningWorker } from './worker';

function testLogger(): Logger & Record<'info' | 'warn' | 'error' | 'debug', jest.Mock> {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as never;
}

/** Polls `check` until it returns true or `timeoutMs` passes. */
async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe('defineJob', () => {
  it('rejects names pg-boss or our conventions would not accept', () => {
    const handler = async () => undefined;
    expect(() => defineJob({ name: 'Purge Expired', handler })).toThrow(/lowercase/);
    expect(() => defineJob({ name: 'purge-expired', handler })).not.toThrow();
  });

  it('lists every job once', () => {
    expect(new Set(jobNames).size).toBe(allJobs.length);
    expect(jobNames).toContain(purgeExpiredJob.name);
  });
});

// NFR-23: enqueuing never throws or blocks, even with no usable database.
describe('createJobQueue without a database', () => {
  it('returns null when no database is configured', async () => {
    const log = testLogger();
    const queue = createJobQueue({ databaseUrl: '', queueNames: [], log });
    await expect(queue.start()).resolves.toBe(false);
    await expect(queue.enqueue('purge-expired')).resolves.toBeNull();
    expect(log.warn).toHaveBeenCalled();
    await queue.stop();
  });

  it('returns null when the database is unreachable, and keeps trying later', async () => {
    const log = testLogger();
    const queue = createJobQueue({ databaseUrl: DEAD_DATABASE_URL, queueNames: [], log });
    await expect(queue.start()).resolves.toBe(false);
    await expect(queue.enqueue('purge-expired')).resolves.toBeNull();
    await expect(queue.enqueue('purge-expired')).resolves.toBeNull();
    expect(log.warn).toHaveBeenCalledTimes(3);
    await queue.stop();
  });

  it('gives up after the timeout instead of hanging', async () => {
    // A server that accepts connections and never answers, like a stuck database.
    const sockets = new Set<Socket>();
    const server = createServer((socket) => sockets.add(socket));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const log = testLogger();
      const queue = createJobQueue({
        databaseUrl: `postgres://manabi:manabi@127.0.0.1:${port}/manabi`,
        queueNames: [],
        log,
        timeoutMs: 200,
      });
      const started = Date.now();
      await expect(queue.enqueue('purge-expired')).resolves.toBeNull();
      expect(Date.now() - started).toBeLessThan(2000);
      expect(log.warn.mock.calls[0]![0].err.message).toMatch(/timed out/);
      // Stopping waits for the stuck attempt to hit pg's connection timeout, then returns.
      await queue.stop();
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    }
  }, 15_000);
});

describeWithDb('jobs with a database', () => {
  const pool = useTestDatabase();
  let queue: JobQueue | undefined;
  let worker: RunningWorker | undefined;

  beforeEach(async () => {
    // Jobs left over from an earlier test would run in this one.
    await query(pool(), `DELETE FROM ${BOSS_SCHEMA}.job`).catch(() => undefined);
  });

  afterEach(async () => {
    await worker?.stop();
    await queue?.stop();
    worker = undefined;
    queue = undefined;
  });

  it('accepts a job while no worker runs, and the job runs once a worker starts', async () => {
    const received: object[] = [];
    const echo = defineJob<{ n: number }>({
      name: 'test-echo',
      handler: async (data) => {
        received.push(data);
      },
    });
    queue = createJobQueue({
      databaseUrl: testDatabaseUrl(),
      queueNames: [echo.name],
      log: testLogger(),
    });

    const id = await queue.enqueue(echo.name, { n: 1 });
    expect(id).toEqual(expect.any(String));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toEqual([]);

    worker = await startWorker({
      databaseUrl: testDatabaseUrl(),
      jobs: [echo],
      log: testLogger(),
      pollingIntervalSeconds: 0.5,
    });
    await waitFor(() => received.length > 0);
    expect(received).toEqual([{ n: 1 }]);
  });

  it('returns null for a queue that does not exist', async () => {
    const log = testLogger();
    queue = createJobQueue({ databaseUrl: testDatabaseUrl(), queueNames: [], log });
    await expect(queue.enqueue('no-such-job')).resolves.toBeNull();
    expect(log.warn).toHaveBeenCalledWith({ job: 'no-such-job' }, expect.any(String));
  });

  it('retries a failing job and logs the failure', async () => {
    let attempts = 0;
    const flaky = defineJob({
      name: 'test-flaky',
      queue: { retryLimit: 1, retryDelay: 0 },
      handler: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('first attempt fails');
      },
    });
    queue = createJobQueue({
      databaseUrl: testDatabaseUrl(),
      queueNames: [flaky.name],
      log: testLogger(),
    });
    const log = testLogger();
    worker = await startWorker({
      databaseUrl: testDatabaseUrl(),
      jobs: [flaky],
      log,
      pollingIntervalSeconds: 0.5,
    });
    await queue.enqueue(flaky.name);
    await waitFor(() => attempts === 2);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'test-flaky' }),
      'job failed',
    );
  });

  // DR-08
  it('schedules the nightly purge and runs it when sent', async () => {
    const user = await seedUser(pool());
    await query(
      pool(),
      `INSERT INTO sessions (user_id, token_hash, client_kind, created_at, expires_at)
       VALUES ($1, $2, 'web', now() - interval '31 days', now() - interval '1 day')`,
      [user.id, tokenHash(1)],
    );
    worker = await startWorker({
      databaseUrl: testDatabaseUrl(),
      jobs: allJobs,
      log: testLogger(),
      timeZone: 'Asia/Tokyo',
      pollingIntervalSeconds: 0.5,
    });

    const schedules = await query<{ name: string; cron: string; timezone: string }>(
      pool(),
      `SELECT name, cron, timezone FROM ${BOSS_SCHEMA}.schedule`,
    );
    expect(schedules).toEqual([
      { name: 'purge-expired', cron: purgeExpiredJob.cron, timezone: 'Asia/Tokyo' },
    ]);

    queue = createJobQueue({
      databaseUrl: testDatabaseUrl(),
      queueNames: jobNames,
      log: testLogger(),
    });
    await queue.enqueue(purgeExpiredJob.name);
    await waitFor(async () => {
      const rows = await query(pool(), 'SELECT id FROM sessions');
      return rows.length === 0;
    });
  });

  it('lets a running job finish when the worker stops', async () => {
    let finished = false;
    let started = false;
    const slow = defineJob({
      name: 'test-slow',
      handler: async () => {
        started = true;
        await new Promise((resolve) => setTimeout(resolve, 500));
        finished = true;
      },
    });
    queue = createJobQueue({
      databaseUrl: testDatabaseUrl(),
      queueNames: [slow.name],
      log: testLogger(),
    });
    const log = testLogger();
    worker = await startWorker({
      databaseUrl: testDatabaseUrl(),
      jobs: [slow],
      log,
      pollingIntervalSeconds: 0.5,
    });
    await queue.enqueue(slow.name);
    await waitFor(() => started);

    await worker.stop();
    expect(finished).toBe(true);
    expect(log.info).toHaveBeenLastCalledWith('worker stopped');
    // A second stop is a no-op.
    await worker.stop();
  });

  it('fails to start, without leaking connections, when the database is unreachable', async () => {
    await expect(
      startWorker({ databaseUrl: DEAD_DATABASE_URL, jobs: allJobs, log: testLogger() }),
    ).rejects.toThrow();
  });
});

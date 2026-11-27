import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { describeWithDb, testDatabaseUrl } from './test/db';

interface LogLine {
  level: number;
  msg: string;
  service?: string;
  [key: string]: unknown;
}

// Runs the real worker entry point (src/worker.ts) as a child process, as the compose `worker`
// service does, and stops it with SIGTERM.
describeWithDb('worker process', () => {
  it('logs structured JSON and exits 0 on SIGTERM', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', join(__dirname, 'worker.ts')], {
      cwd: join(__dirname, '..'),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'development',
        DATABASE_URL: testDatabaseUrl(),
        LOG_LEVEL: 'info',
        TZ: 'UTC',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    // 'close', not 'exit': 'exit' can fire while stdout still holds unread lines, which made
    // the last line read 'worker stopping' instead of 'worker stopped' (#235). 'close' fires
    // only after the process has exited and its stdio streams have ended.
    const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) =>
      child.on('close', (code, signal) => resolve({ code, signal })),
    );
    await new Promise<void>((resolve, reject) => {
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.includes('"worker started"')) resolve();
      });
      child.on('exit', () => reject(new Error(`worker exited early: ${stderr}`)));
    });

    child.kill('SIGTERM');
    // Exit code 0, not death by the signal; stderr is included to explain a failure.
    expect({ ...(await exited), stderr }).toEqual({ code: 0, signal: null, stderr: '' });

    const lines = stdout
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as LogLine);
    expect(lines.every((line) => line.service === 'worker' && typeof line.level === 'number')).toBe(
      true,
    );
    expect(lines.map((line) => line.msg)).toEqual(
      expect.arrayContaining(['worker started', 'worker stopping', 'worker stopped']),
    );
    expect(lines.at(-1)!.msg).toBe('worker stopped');
    expect(stdout).not.toContain(testDatabaseUrl());
  }, 30_000);
});

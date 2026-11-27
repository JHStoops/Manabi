import { ConfigError, loadConfig } from './config';
import { allJobs } from './jobs';
import { startWorker } from './jobs/worker';
import type { RunningWorker } from './jobs/worker';
import { createLogger } from './logger';

/**
 * The `worker` service (SDD section 12): same image and config as the API, runs background and
 * scheduled jobs with pg-boss. Logs structured JSON to stdout; exits 0 on SIGTERM or SIGINT
 * once running jobs have finished or timed out.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const log = createLogger(config, { service: 'worker' });

  // Signal handlers go in before start-up, so a stop requested while starting is not lost to
  // Node's default (exit by signal); the stop then runs as soon as the worker is up.
  let worker: RunningWorker | undefined;
  let requested: NodeJS.Signals | undefined;
  // Flush the logger before exiting (#235). pino's default stdout destination writes synchronously,
  // so this is a safeguard for a buffered destination rather than the fix itself: the flaky test
  // read stdout on 'exit', before the pipe had delivered the last line ('close' is the fix).
  const exit = (code: number): void => {
    log.flush(() => process.exit(code));
  };
  const stop = (signal: NodeJS.Signals): void => {
    if (!worker) {
      requested = signal;
      return;
    }
    log.info({ signal }, 'worker stopping');
    worker.stop().then(
      () => exit(0),
      (err: unknown) => {
        log.error({ err }, 'worker did not stop cleanly');
        exit(1);
      },
    );
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);

  try {
    worker = await startWorker({ databaseUrl: config.databaseUrl, jobs: allJobs, log });
  } catch (err) {
    log.error({ err }, 'worker failed to start');
    exit(1);
    return;
  }
  if (requested) stop(requested);
}

main().catch((err: unknown) => {
  // A configuration error is already a clear, value-free message; no stack trace needed.
  console.error(err instanceof ConfigError ? err.message : err);
  process.exit(1);
});

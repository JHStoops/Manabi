import { buildApp } from './app';
import { ConfigError, loadConfig } from './config';
import { runMigrations } from './db/migrate';
import { createPool } from './db/pool';
import { backfillLibraryFields } from './modules/library/service';

async function main(): Promise<void> {
  const config = loadConfig();
  // NFR-52: apply pending forward-only migrations before serving (SDD section 12).
  await runMigrations({ databaseUrl: config.databaseUrl, log: console.log });
  const app = await buildApp({ config, pool: createPool(config.databaseUrl) });
  // Migration 0011 added library search columns; items written before it are filled once here.
  await backfillLibraryFields(app.db);

  const stop = async (): Promise<void> => {
    await app.close();
    await app.db.end();
    process.exit(0);
  };
  process.once('SIGTERM', () => void stop());
  process.once('SIGINT', () => void stop());

  await app.listen({ host: config.host, port: config.port });
  // Connect the job queue now rather than on the first enqueue; failure is logged, not fatal.
  void app.jobs.start();
}

main().catch((err: unknown) => {
  // A configuration error is already a clear, value-free message; no stack trace needed.
  console.error(err instanceof ConfigError ? err.message : err);
  process.exit(1);
});

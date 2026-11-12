import { loadConfig } from './config';
import { runMigrations } from './db/migrate';

/** `npm run migrate`: applies pending migrations to DATABASE_URL and exits. */
async function main(): Promise<void> {
  const config = loadConfig();
  const applied = await runMigrations({ databaseUrl: config.databaseUrl, log: console.log });
  console.log(
    applied.length === 0 ? 'Database is up to date' : `Applied ${applied.length} migration(s)`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

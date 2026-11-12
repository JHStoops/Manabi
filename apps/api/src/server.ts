import { buildApp } from './app';
import { loadConfig } from './config';
import { runMigrations } from './db/migrate';

async function main(): Promise<void> {
  const config = loadConfig();
  // NFR-52: apply pending forward-only migrations before serving (SDD section 12).
  await runMigrations({ databaseUrl: config.databaseUrl, log: console.log });
  const app = await buildApp(config);
  await app.listen({ host: config.host, port: config.port });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

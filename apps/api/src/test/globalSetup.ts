import { runMigrations } from '../db/migrate';
import {
  BASE_ENV,
  createDatabase,
  newBaseName,
  templateName,
  withAdminClient,
  withDatabase,
  workerDatabaseName,
} from './testDatabase';

/**
 * Creates fresh databases for this test run against the server in DATABASE_URL:
 * a template with all migrations applied, then one clone per Jest worker.
 */
export default async function globalSetup(globalConfig: { maxWorkers: number }): Promise<void> {
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) {
    if (process.env.CI) throw new Error('DATABASE_URL must be set in CI for integration tests');
    console.warn('\nDATABASE_URL is not set: database integration tests will be skipped.');
    return;
  }

  const base = newBaseName();
  const template = templateName(base);
  await withAdminClient(adminUrl, (client) => createDatabase(client, template));
  await runMigrations({ databaseUrl: withDatabase(adminUrl, template) });

  await withAdminClient(adminUrl, async (client) => {
    for (let worker = 1; worker <= Math.max(1, globalConfig.maxWorkers); worker++) {
      await createDatabase(client, workerDatabaseName(base, String(worker)), template);
    }
  });
  process.env[BASE_ENV] = base;
}

import { BASE_ENV, dropDatabase, listRunDatabases, withAdminClient } from './testDatabase';

/** Drops every database this test run created. */
export default async function globalTeardown(): Promise<void> {
  const adminUrl = process.env.DATABASE_URL;
  const base = process.env[BASE_ENV];
  if (!adminUrl || !base) return;
  await withAdminClient(adminUrl, async (client) => {
    for (const name of await listRunDatabases(client, base)) {
      await dropDatabase(client, name);
    }
  });
}

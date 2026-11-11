import PgBoss from 'pg-boss';
import { loadConfig } from './config';

// PLACEHOLDER: starts pg-boss only; no job handlers are registered yet.
async function main(): Promise<void> {
  const config = loadConfig();
  const boss = new PgBoss(config.databaseUrl);
  boss.on('error', (err: Error) => console.error(err));
  await boss.start();
  console.log('worker started (no jobs registered)');

  const stop = async (): Promise<void> => {
    await boss.stop();
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

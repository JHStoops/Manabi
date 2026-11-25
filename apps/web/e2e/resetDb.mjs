import process from 'node:process';
import pg from 'pg';

// Wipes the e2e database so each run starts from the migrations alone. Only E2E_DATABASE_URL is
// read, never DATABASE_URL, so it cannot wipe a development database by accident.
const url = process.env.E2E_DATABASE_URL;
if (!url) throw new Error('Set E2E_DATABASE_URL to a scratch database; its contents are dropped.');
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE');
await client.query('CREATE SCHEMA public');
await client.end();

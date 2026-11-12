import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { query } from './db';
import { defaultMigrationsDir, runMigrations } from './migrate';
import { describeWithDb, testDatabaseUrl, useTestDatabase } from '../test/db';

const migrationsDir = defaultMigrationsDir();
const sqlFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

describe('migration files (NFR-52)', () => {
  it('are numbered NNNN_name.sql with unique, gap-free numbers', () => {
    expect(sqlFiles.length).toBeGreaterThan(0);
    sqlFiles.forEach((file, index) => {
      expect(file).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
      expect(Number(file.slice(0, 4))).toBe(index + 1);
    });
  });

  it('are forward-only: no file has a down migration', () => {
    for (const file of sqlFiles) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      expect(sql).toMatch(/^-- Up Migration/m);
      expect(sql).not.toMatch(/^\s*--[\s-]*down\s+migration/im);
    }
  });
});

describe('runMigrations', () => {
  it('refuses to run without a database URL', async () => {
    await expect(runMigrations({ databaseUrl: '' })).rejects.toThrow('DATABASE_URL is not set');
  });
});

describeWithDb('runMigrations against PostgreSQL', () => {
  // A fresh, empty schema in this worker's database stands in for an empty database
  // (cheaper than CREATE DATABASE, which forces a checkpoint).
  const schema = `fresh_${process.pid}_${Date.now()}`;
  const getPool = useTestDatabase();

  afterEach(async () => {
    await getPool().query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  });

  it('applies every migration to an empty schema, then is a no-op', async () => {
    const url = testDatabaseUrl();
    const messages: string[] = [];
    const first = await runMigrations({ databaseUrl: url, schema, log: (m) => messages.push(m) });
    expect(first).toEqual(sqlFiles.map((f) => f.replace(/\.sql$/, '')));
    expect(messages.some((m) => m.includes("Can't determine timestamp"))).toBe(false);

    const second = await runMigrations({ databaseUrl: url, schema });
    expect(second).toEqual([]);

    const tables = await query<{ table_name: string }>(
      getPool(),
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY 1`,
      [schema],
    );
    expect(tables.map((t) => t.table_name)).toEqual(
      expect.arrayContaining(['courses', 'items', 'sentences', 'stroke_data', 'pgmigrations']),
    );
    const applied = await query<{ name: string }>(
      getPool(),
      `SELECT name FROM "${schema}".pgmigrations ORDER BY id`,
    );
    expect(applied.map((r) => r.name)).toEqual(first);
  });
});

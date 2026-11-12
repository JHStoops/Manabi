import { query } from './db';
import { describeWithDb, useTestDatabase } from '../test/db';

// Schema-wide checks over every migration, read from the catalog.

describeWithDb('schema (all migrations)', () => {
  const pool = useTestDatabase();

  it('creates the account, progress, social and admin tables (SDD section 5)', async () => {
    const rows = await query<{ table_name: string }>(
      pool(),
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining([
        'users',
        'invites',
        'sessions',
        'password_resets',
        'enrollments',
        'lesson_progress',
        'lesson_sessions',
        'item_progress',
        'review_log',
        'xp_events',
        'user_stats',
        'user_notes',
        'boosters',
        'follows',
        'nudges',
        'weekly_results',
        'achievements',
        'user_achievements',
        'answer_reports',
        'import_runs',
      ]),
    );
  });

  it('stores every timestamp as timestamptz (DR-05)', async () => {
    const rows = await query<{ col: string }>(
      pool(),
      // pgmigrations belongs to node-pg-migrate, not to the app schema.
      `SELECT table_name || '.' || column_name AS col FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name <> 'pgmigrations'
          AND data_type IN ('timestamp without time zone', 'time without time zone',
                            'time with time zone')`,
    );
    expect(rows).toEqual([]);
    const timestamptz = await query<{ n: number }>(
      pool(),
      `SELECT count(*) AS n FROM information_schema.columns
        WHERE table_schema = 'public' AND data_type = 'timestamp with time zone'`,
    );
    expect(timestamptz[0]!.n).toBeGreaterThan(50);
  });

  it('stores the local calendar date on each XP event (DR-05)', async () => {
    const rows = await query<{ data_type: string; is_nullable: string }>(
      pool(),
      `SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'xp_events' AND column_name = 'local_date'`,
    );
    expect(rows).toEqual([{ data_type: 'date', is_nullable: 'NO' }]);
  });

  it('keeps only the NFR-61 personal fields on users', async () => {
    const rows = await query<{ column_name: string }>(
      pool(),
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position`,
    );
    // Personal (NFR-61): username, email, display_name, time_zone, settings.
    // Not personal: the id, credentials (hash only, NFR-10), role and account state, timestamps.
    expect(rows.map((r) => r.column_name)).toEqual([
      'id',
      'username',
      'email',
      'password_hash',
      'display_name',
      'role',
      'must_change_password',
      'password_expires_at',
      'time_zone',
      'settings',
      'disabled_at',
      'created_at',
      'updated_at',
    ]);
  });
});

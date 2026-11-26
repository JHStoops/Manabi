import type { Pool } from 'pg';
import { query } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedCourse, seedLesson, seedUser, tokenHash } from '../../test/fixtures';
import { purgeExpired } from './service';

const HOUR = 3600_000;

/**
 * Seeds one expired and one live row in each table, relative to `now`. Rows are created two
 * days before their expiry so the expires-after-created CHECKs hold.
 */
async function seedExpiringRows(pool: Pool, now: Date): Promise<void> {
  const user = await seedUser(pool);
  const { lessonId } = await seedLesson(pool, await seedCourse(pool));
  const expired = new Date(now.getTime() - HOUR);
  const live = new Date(now.getTime() + HOUR);
  const created = (at: Date) => new Date(at.getTime() - 48 * HOUR);

  let n = 0;
  for (const [label, expiresAt] of [
    ['expired', expired],
    ['live', live],
  ] as const) {
    await query(
      pool,
      `INSERT INTO sessions (user_id, token_hash, client_kind, created_at, expires_at)
       VALUES ($1, $2, 'web', $3, $4)`,
      [user.id, tokenHash(++n), created(expiresAt), expiresAt],
    );
    // An unused, a used and a revoked invite: all go once expired, none before.
    await query(
      pool,
      `INSERT INTO invites (token_hash, email, created_at, expires_at, used_by, used_at, revoked_at)
       VALUES ($1, $4, $2, $3, NULL, NULL, NULL),
              ($5, NULL, $2, $3, $7::bigint, $2, NULL),
              ($6, NULL, $2, $3, NULL, NULL, $2)`,
      [
        tokenHash(++n),
        created(expiresAt),
        expiresAt,
        `${label}@example.com`,
        tokenHash(++n),
        tokenHash(++n),
        user.id,
      ],
    );
    // An unused and a used reset link.
    await query(
      pool,
      `INSERT INTO password_resets (user_id, token_hash, origin, created_at, expires_at, used_at)
       VALUES ($1, $2, 'email', $4, $5, NULL), ($1, $3, 'admin', $4, $5, $4)`,
      [user.id, tokenHash(++n), tokenHash(++n), created(expiresAt), expiresAt],
    );
    await query(
      pool,
      `INSERT INTO lesson_sessions (user_id, lesson_id, state, created_at, expires_at)
       VALUES ($1, $2, '{}', $3, $4)`,
      [user.id, lessonId, created(expiresAt), expiresAt],
    );
  }
}

async function remainingExpiries(pool: Pool, table: string): Promise<number[]> {
  const rows = await query<{ expires_at: Date }>(
    pool,
    `SELECT expires_at FROM ${table} ORDER BY id`,
  );
  return rows.map((r) => r.expires_at.getTime());
}

// DR-08
describeWithDb('purgeExpired', () => {
  const pool = useTestDatabase();

  it('deletes only rows whose expiry has passed, from all four tables', async () => {
    const now = new Date();
    await seedExpiringRows(pool(), now);

    const deleted = await purgeExpired(pool(), now);

    expect(deleted).toEqual({
      sessions: 1,
      invites: 3,
      passwordResets: 2,
      lessonSessions: 1,
      reviewSessions: 0,
    });
    const live = now.getTime() + HOUR;
    expect(await remainingExpiries(pool(), 'sessions')).toEqual([live]);
    expect(await remainingExpiries(pool(), 'invites')).toEqual([live, live, live]);
    expect(await remainingExpiries(pool(), 'password_resets')).toEqual([live, live]);
    expect(await remainingExpiries(pool(), 'lesson_sessions')).toEqual([live]);
  });

  it('treats a row expiring exactly now as expired', async () => {
    const now = new Date();
    await seedExpiringRows(pool(), new Date(now.getTime() + HOUR));

    const deleted = await purgeExpired(pool(), now);

    expect(deleted).toEqual({
      sessions: 1,
      invites: 3,
      passwordResets: 2,
      lessonSessions: 1,
      reviewSessions: 0,
    });
  });

  it('uses the database clock by default and leaves users and progress alone', async () => {
    await seedExpiringRows(pool(), new Date());

    const deleted = await purgeExpired(pool());

    expect(deleted).toEqual({
      sessions: 1,
      invites: 3,
      passwordResets: 2,
      lessonSessions: 1,
      reviewSessions: 0,
    });
    const [users] = await query<{ count: number }>(pool(), 'SELECT count(*) AS count FROM users');
    expect(users!.count).toBe(1);
  });

  it('deletes nothing when nothing has expired', async () => {
    await expect(purgeExpired(pool())).resolves.toEqual({
      sessions: 0,
      invites: 0,
      passwordResets: 0,
      lessonSessions: 0,
      reviewSessions: 0,
    });
  });
});

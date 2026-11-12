import type { Pool } from 'pg';
import { query } from '../db/db';
import { insertUser } from '../modules/auth/queries';
import type { NewUser } from '../modules/auth/queries';
import type { UserRow } from '../modules/auth/rows';
import { insertCourse } from '../modules/content/queries';

/** Small seed helpers shared by schema integration tests. */

/** A syntactically valid Argon2id PHC string (not a real hash of anything). */
export const ARGON2ID_HASH = '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA';

/** A SHA-256 hex digest shape for token_hash columns; `n` varies it. */
export function tokenHash(n: number): string {
  return n.toString(16).padStart(64, '0');
}

export function seedUser(pool: Pool, overrides: Partial<NewUser> = {}): Promise<UserRow> {
  const username = overrides.username ?? 'learner';
  return insertUser(pool, {
    username,
    email: `${username}@example.com`,
    passwordHash: ARGON2ID_HASH,
    displayName: username,
    role: 'learner',
    timeZone: 'Asia/Tokyo',
    ...overrides,
  });
}

export async function seedCourse(pool: Pool): Promise<number> {
  const course = await insertCourse(pool, {
    key: 'ja-en',
    targetLang: 'ja',
    baseLang: 'en',
    plugin: 'ja',
    title: 'Japanese for English speakers',
  });
  return course.id;
}

/** Inserts `count` word items into the course and returns their ids in order. */
export async function seedItems(pool: Pool, courseId: number, count: number): Promise<number[]> {
  const rows = await query<{ id: number }>(
    pool,
    `INSERT INTO items (course_id, key, type, level_code)
     SELECT $1, 'ja:word:' || n, 'word', 'N5' FROM generate_series(1, $2) AS n
     RETURNING id`,
    [courseId, count],
  );
  return rows.map((r) => r.id);
}

/** A course with one section, unit and lesson; returns the ids. */
export async function seedLesson(
  pool: Pool,
  courseId: number,
): Promise<{ lessonId: number; unitId: number }> {
  const [row] = await query<{ lesson_id: number; unit_id: number }>(
    pool,
    `WITH s AS (
       INSERT INTO sections (course_id, key, position, title, level_code)
       VALUES ($1, 'ja-en:n5', 0, 'N5', 'N5') RETURNING id
     ), u AS (
       INSERT INTO units (section_id, key, position, title)
       SELECT id, 'ja-en:n5:u1', 0, 'Unit 1' FROM s RETURNING id
     )
     INSERT INTO lessons (unit_id, key, position, type, title)
     SELECT id, 'ja-en:n5:u1:l1', 0, 'vocabulary', 'Lesson 1' FROM u
     RETURNING id AS lesson_id, unit_id`,
    [courseId],
  );
  return { lessonId: row!.lesson_id, unitId: row!.unit_id };
}

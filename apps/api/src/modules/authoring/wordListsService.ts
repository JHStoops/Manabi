import type {
  BlockedWord,
  CreateBlockedWordRequest,
  CreateSupplementaryWordRequest,
  SupplementaryWord,
  UpdateSupplementaryWordRequest,
} from '@manabi/core';
import type { Queryable } from '../../db/db';
import { AppError } from '../../errors';
import * as q from './wordListsQueries';

// FR-234, FR-237: the admin-edited word lists. The database holds the edits; `pack export`
// writes them back to the pack files, and a pack import replaces them with the files' lists.

const DUPLICATE_WORD = 'That word is already on the list';

/** Maps the unique-constraint violation of an insert or update to a 409. */
async function unlessDuplicate<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new AppError('conflict', DUPLICATE_WORD);
    throw e;
  }
}

export const listSupplementaryWords = (
  db: Queryable,
  filter: { course?: string; level?: string },
): Promise<SupplementaryWord[]> =>
  q.listSupplementaryWords(db, filter.course ?? null, filter.level ?? null);

export async function addSupplementaryWord(
  db: Queryable,
  body: CreateSupplementaryWordRequest,
): Promise<SupplementaryWord> {
  const courseId = await q.findCourseWithLevel(db, body.course, body.level);
  if (courseId === null) {
    throw new AppError('not_found', 'No such course, or it has no section at that level');
  }
  const id = await unlessDuplicate(() =>
    q.insertSupplementaryWord(db, { courseId, ...body, note: body.note ?? null }),
  );
  return (await q.findSupplementaryWord(db, id))!;
}

export async function editSupplementaryWord(
  db: Queryable,
  id: number,
  body: UpdateSupplementaryWordRequest,
): Promise<SupplementaryWord> {
  const word = await q.findSupplementaryWord(db, id);
  if (!word) throw new AppError('not_found', 'Supplementary word not found');
  const next = { ...word, ...body, note: body.note === undefined ? word.note : body.note };
  if ((await q.findCourseWithLevel(db, word.course, next.level)) === null) {
    throw new AppError('not_found', 'The course has no section at that level');
  }
  await unlessDuplicate(() => q.updateSupplementaryWord(db, id, next));
  return { ...next, id };
}

export async function removeSupplementaryWord(db: Queryable, id: number): Promise<void> {
  if (!(await q.deleteSupplementaryWord(db, id))) {
    throw new AppError('not_found', 'Supplementary word not found');
  }
}

export const listBlockedWords = (db: Queryable, lang?: string): Promise<BlockedWord[]> =>
  q.listBlockedWords(db, lang ?? null);

export const addBlockedWord = (
  db: Queryable,
  body: CreateBlockedWordRequest,
): Promise<BlockedWord> => unlessDuplicate(() => q.insertBlockedWord(db, body.lang, body.word));

export async function removeBlockedWord(db: Queryable, id: number): Promise<void> {
  if (!(await q.deleteBlockedWord(db, id)))
    throw new AppError('not_found', 'Blocked word not found');
}

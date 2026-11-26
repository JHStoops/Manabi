import { STAGE_BANDS } from '@manabi/core';
import type {
  LibraryItem,
  LibraryItemDetail,
  LibraryItemPage,
  LibraryItemsQuery,
} from '@manabi/core';
import type { Queryable } from '../../db/db';
import { AppError } from '../../errors';
import { languagePlugins } from '../../plugins';
import type { AuthContext } from '../auth/service';
import { findCourse } from '../courses/queries';
import * as q from './queries';

// Library: item lists with filters and search, and item detail (FR-075, FR-092, FR-102).

const toItem = (row: q.LibraryItemRow): LibraryItem => ({
  id: row.id,
  key: row.key,
  type: row.type,
  levelCode: row.level_code,
  data: row.data,
  stage: row.stage,
});

/** Published courses only; admins also browse drafts, as in `GET /courses`. */
async function visibleCourse(db: Queryable, auth: AuthContext, courseId: number, what = 'Course') {
  const course = await findCourse(db, courseId);
  if (!course || (course.status !== 'published' && auth.user.role !== 'admin')) {
    throw new AppError('not_found', `${what} not found`);
  }
  return course;
}

const encodeCursor = (id: number) => Buffer.from(String(id)).toString('base64url');

function decodeCursor(cursor: string): number {
  const id = Number(Buffer.from(cursor, 'base64url').toString());
  if (!Number.isSafeInteger(id) || id < 0) throw new AppError('bad_request', 'Invalid cursor');
  return id;
}

/** FR-075, FR-092: one page of a course's items, oldest first, with the learner's stages. */
export async function listItems(
  db: Queryable,
  auth: AuthContext,
  query: LibraryItemsQuery,
): Promise<LibraryItemPage> {
  const course = await visibleCourse(db, auth, query.courseId);
  const plugin = languagePlugins.forCourse(course);
  const term = query.q === undefined ? '' : plugin.searchKey(query.q);
  // A query that folds to nothing ("-") matches nothing, rather than lifting the search.
  if (query.q !== undefined && term === '') return { items: [], nextCursor: null };
  const band = query.stage === undefined ? undefined : STAGE_BANDS[query.stage];
  const rows = await q.listItems(db, {
    courseId: course.id,
    userId: auth.userId,
    type: query.type ?? null,
    level: query.level ?? null,
    strokeCount: query.strokeCount ?? null,
    radical: query.radical ?? null,
    pattern: term === '' ? null : `%${term.replace(/[\\%_]/g, '\\$&')}%`,
    notStarted: query.stage === 'not_started',
    stages: band ?? null,
    afterId: query.cursor === undefined ? null : decodeCursor(query.cursor),
    // One extra row tells whether another page follows.
    limit: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  return {
    items: page.map(toItem),
    nextCursor: rows.length > query.limit ? encodeCursor(page.at(-1)!.id) : null,
  };
}

/** FR-070, FR-092: the item with the learner's facets, linked items and example sentences. */
export async function getItem(
  db: Queryable,
  auth: AuthContext,
  key: string,
): Promise<LibraryItemDetail> {
  const item = await q.findItem(db, auth.userId, key);
  if (!item) throw new AppError('not_found', 'Item not found');
  await visibleCourse(db, auth, item.course_id, 'Item');
  const [facets, links, sentences] = await Promise.all([
    q.listFacets(db, auth.userId, item.id),
    q.listLinks(db, auth.userId, item.id),
    q.listExampleSentences(db, item),
  ]);
  return {
    ...toItem(item),
    facets: facets.map((f) => ({
      facet: f.facet,
      stage: f.stage,
      dueAt: f.due_at?.toISOString() ?? null,
    })),
    links: links.map((l) => ({ kind: l.kind, direction: l.direction, item: toItem(l) })),
    sentences,
  };
}

/**
 * Stores the course plugin's library fields on the course's items: those with `keys`, or all of
 * them. Every item write calls this after it, inside its transaction.
 */
export async function refreshLibraryFields(
  db: Queryable,
  courseId: number,
  keys: readonly string[] | null = null,
  onlyMissing = false,
): Promise<void> {
  const course = await findCourse(db, courseId);
  if (!course) return;
  const plugin = languagePlugins.forCourse(course);
  const items = await q.listItemsForLibraryFields(db, courseId, keys, onlyMissing);
  await q.setLibraryFields(
    db,
    items.map((item) => {
      const fields = plugin.libraryFields(item);
      return {
        id: item.id,
        searchText: fields.terms.join('\n'),
        strokeCount: fields.strokeCount,
        radical: fields.radical,
      };
    }),
  );
}

/** Fills the library fields of items written before they existed (migration 0011). */
export async function backfillLibraryFields(db: Queryable): Promise<void> {
  for (const course of await q.listCoursesMissingLibraryFields(db)) {
    await refreshLibraryFields(db, course.id, null, true);
  }
}

import type { Pool } from 'pg';
import {
  acceptsAnswerReports,
  getExerciseType,
  gradeResponse,
  idSchema,
  payloadItemIds,
  pluginIdSchema,
  SecondAttemptError,
  sessionExerciseSchema,
  z,
} from '@manabi/core';
import type {
  AnswerReport,
  AnswerReportPage,
  AnswerReportReceipt,
  AnswerReportsQuery,
  CreateAnswerReportRequest,
  LanguagePlugin,
  SessionExercise,
} from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import { languagePlugins } from '../../plugins';
import type { ScopedUserId } from '../auth/service';
import type { JsonObject } from '../content/rows';
import { segment } from '../authoring/lessonEditorService';
import { insertExercise } from '../authoring/lessonEditorQueries';
import { stableJson } from '../lessons/service';
import * as q from './queries';

// Answer reports (FR-054, FR-229; Product Spec sections 4 and 11). A learner files one from the
// feedback bar; an author accepts it (the answer joins the exercise's accept list) or dismisses
// it. Reports and accept lists are content: nothing here writes to a progress table.

/** The exercise as the session served it, and where it came from. */
interface Played {
  exercise: SessionExercise;
  courseId: number;
  plugin: string;
  lessonId: number | null;
  itemId: number | null;
}

const sessionStateSchema = z.object({ exercises: z.array(sessionExerciseSchema) });
const reviewStateSchema = z.object({
  exercises: z.array(
    sessionExerciseSchema.extend({ itemId: idSchema, courseId: idSchema, plugin: pluginIdSchema }),
  ),
});

/**
 * The server's copy of the exercise, found in the learner's own session by type and payload, so
 * a report never carries a payload the client made up. Null when the session is not theirs or
 * has no such exercise.
 */
async function findPlayed(
  db: Queryable,
  userId: number,
  body: CreateAnswerReportRequest,
): Promise<Played | null> {
  const wanted = stableJson({ type: body.exercise.type, payload: body.exercise.payload });
  const same = (e: SessionExercise) => stableJson({ type: e.type, payload: e.payload }) === wanted;
  if (body.session.kind === 'lesson') {
    const session = await q.findLessonSession(db, userId, body.session.id);
    if (!session) return null;
    const exercise = sessionStateSchema.parse(session.state).exercises.find(same);
    if (!exercise) return null;
    return {
      exercise: { type: exercise.type, payload: exercise.payload },
      courseId: session.course_id,
      plugin: session.plugin,
      // A unit test-out has no lesson: accepting pins its exercise at item level.
      lessonId: session.lesson_id,
      itemId: payloadItemIds(exercise.payload)[0] ?? null,
    };
  }
  const session = await q.findReviewSession(db, userId, body.session.id);
  if (!session) return null;
  const exercise = reviewStateSchema.parse(session.state).exercises.find(same);
  if (!exercise) return null;
  return {
    exercise: { type: exercise.type, payload: exercise.payload },
    courseId: exercise.courseId,
    plugin: exercise.plugin,
    lessonId: null,
    itemId: exercise.itemId,
  };
}

const toReceipt = (row: q.AnswerReportRow): AnswerReportReceipt => ({
  id: row.id,
  status: row.status,
  createdAt: row.created_at.toISOString(),
});

/**
 * FR-054: files the learner's report that `answer` should be accepted for an exercise of their
 * session. Only exercises with an accept list can be reported, and only answers the grader marks
 * wrong. Filing the same open report again returns the first one.
 */
export async function fileReport(
  pool: Pool,
  userId: ScopedUserId,
  body: CreateAnswerReportRequest,
): Promise<{ report: AnswerReportReceipt; created: boolean }> {
  return withTransaction(pool, async (db) => {
    await q.lockUserReports(db, userId);
    const played = await findPlayed(db, userId, body);
    if (!played) throw new AppError('not_found', 'Exercise not found in this session');
    const { exercise } = played;
    if (!acceptsAnswerReports(exercise)) {
      throw new AppError('validation_failed', 'This exercise has no accept list to add to', [
        { location: 'body', path: ['exercise'], message: 'Not a typed exercise' },
      ]);
    }
    let result;
    try {
      result = gradeResponse(
        exercise,
        { attempts: [body.answer] },
        languagePlugins.get(played.plugin),
      ).result;
    } catch (err) {
      if (!(err instanceof z.ZodError || err instanceof SecondAttemptError)) throw err;
      throw new AppError('validation_failed', 'Not a valid answer for this exercise', [
        { location: 'body', path: ['answer'], message: 'Not a valid answer' },
      ]);
    }
    if (result !== 'wrong') throw new AppError('conflict', 'This answer is already accepted');

    const duplicate = await q.findOpenDuplicate(db, {
      userId,
      type: exercise.type,
      payload: exercise.payload,
      answer: body.answer,
    });
    if (duplicate) return { report: toReceipt(duplicate), created: false };

    const exerciseId = await q.findStoredExercise(
      db,
      { courseId: played.courseId, lessonId: played.lessonId, itemId: played.itemId },
      exercise.type,
      exercise.payload,
    );
    if (exerciseId === null && played.itemId === null && played.lessonId === null) {
      // A test-out's generated exercise answered in English names no item, and has no lesson.
      throw new AppError('conflict', 'This exercise cannot be reported');
    }
    const row = await q.insertReport(db, {
      userId,
      exerciseId,
      itemId: played.itemId,
      lessonId: played.lessonId,
      type: exercise.type,
      payload: exercise.payload,
      answer: body.answer,
    });
    return { report: toReceipt(row), created: true };
  });
}

const encodeCursor = (id: number) => Buffer.from(String(id)).toString('base64url');

function decodeCursor(cursor: string): number {
  const id = Number(Buffer.from(cursor, 'base64url').toString());
  if (!Number.isSafeInteger(id) || id < 0) throw new AppError('bad_request', 'Invalid cursor');
  return id;
}

function toReport(row: q.InboxReportRow): AnswerReport {
  const accept = Array.isArray(row.current_accept) ? (row.current_accept as unknown[]) : null;
  return {
    id: row.id,
    status: row.status,
    exerciseType: row.exercise_type,
    exercisePayload: row.exercise_payload,
    givenAnswer: row.given_answer,
    exerciseId: row.exercise_id,
    currentAccept:
      accept?.flatMap((a) =>
        a && typeof (a as { text?: unknown }).text === 'string'
          ? [(a as { text: string }).text]
          : [],
      ) ?? null,
    itemId: row.item_id,
    lessonId: row.lesson_id,
    courseId: row.course_id,
    courseTitle: row.course_title,
    plugin: row.plugin,
    reporter: row.reporter,
    createdAt: row.created_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null,
  };
}

/** FR-229: one page of reports of a status (open by default), oldest first. */
export async function listReports(
  db: Queryable,
  query: AnswerReportsQuery,
): Promise<AnswerReportPage> {
  const rows = await q.listReports(db, {
    status: query.status,
    afterId: query.cursor === undefined ? null : decodeCursor(query.cursor),
    // One extra row tells whether another page follows.
    limit: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  return {
    items: page.map(toReport),
    nextCursor: rows.length > query.limit ? encodeCursor(page.at(-1)!.id) : null,
  };
}

async function getReport(db: Queryable, id: number): Promise<AnswerReport> {
  const row = await q.findInboxReport(db, id);
  if (!row) throw new AppError('not_found', 'Report not found');
  return toReport(row);
}

async function openReport(db: Queryable, id: number): Promise<q.AnswerReportRow> {
  const report = await q.lockReport(db, id);
  if (!report) throw new AppError('not_found', 'Report not found');
  if (report.status !== 'open') throw new AppError('conflict', 'This report is already resolved');
  return report;
}

/**
 * The stored exercise the report's answer goes into, locked. A generated exercise is pinned
 * first, so the accept list persists: into the lesson it was played in, or at item level (where
 * reviews find it) for a review or test-out, or when that lesson is gone. A copy already pinned in
 * that context is extended instead of pinning another, and the other open reports of the same
 * generated exercise in that context are pointed at the pinned one.
 */
async function targetExercise(db: Queryable, report: q.AnswerReportRow) {
  if (report.exercise_id !== null) {
    const exercise = await q.lockExercise(db, report.exercise_id);
    if (!exercise || exercise.archived_at !== null) {
      throw new AppError('conflict', 'The exercise was removed; dismiss the report instead');
    }
    return exercise;
  }
  const pin = { type: report.exercise_type, payload: report.exercise_payload };
  const inLesson = report.lesson_id !== null && (await q.isActiveLesson(db, report.lesson_id));
  const context = {
    lessonId: inLesson ? report.lesson_id : null,
    itemId: inLesson ? null : report.item_id,
  };
  if (!inLesson && (context.itemId === null || !(await q.isActiveItem(db, context.itemId)))) {
    throw new AppError('conflict', "The exercise's lesson and item were removed; dismiss it");
  }
  const { course_id: courseId } = (await q.findInboxReport(db, report.id))!;
  const existing = await q.findStoredExercise(db, { courseId, ...context }, pin.type, pin.payload);
  const exerciseId =
    existing ??
    (context.lessonId !== null
      ? await insertExercise(db, { lessonId: context.lessonId, origin: 'pinned', ...pin })
      : await q.insertItemExercise(db, { itemId: context.itemId!, ...pin })
    ).id;
  await q.linkOpenReports(db, {
    ...pin,
    lessonId: report.lesson_id,
    itemId: report.item_id,
    exerciseId,
  });
  return (await q.lockExercise(db, exerciseId))!;
}

/**
 * FR-229: accepts the report: its answer joins the exercise's accept list, and the report closes.
 * An answer the grader already accepts with the current list (an earlier report added it, or it
 * matches after normalisation) is not added again. A course-language answer gets its tiles
 * segmented as the lesson editor does (DR-12); an answer in the base language has none, like the
 * generated ones. One transaction; resolving is serialized, so concurrent accepts of one
 * generated exercise pin it once.
 */
export async function acceptReport(
  pool: Pool,
  adminId: ScopedUserId,
  id: number,
): Promise<AnswerReport> {
  await withTransaction(pool, async (db) => {
    await q.lockResolving(db);
    const report = await openReport(db, id);
    const exercise = await targetExercise(db, report);
    const payload = structuredClone(exercise.payload);
    const accept = Array.isArray(payload.accept) ? (payload.accept as JsonObject[]) : null;
    if (!accept) throw new AppError('conflict', 'The exercise no longer has an accept list');
    const plugin = languagePlugins.get(exercise.plugin);
    if (!alreadyAccepted(exercise, report.given_answer, plugin)) {
      const tiles =
        payload.answerLanguage === 'base' ? [] : await segment(plugin, report.given_answer);
      accept.push({ text: report.given_answer, tiles });
      const parsed = getExerciseType(exercise.type).payloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new AppError('conflict', 'The answer does not fit the exercise', parsed.error.issues);
      }
      await q.updateExercisePayload(db, exercise.id, payload);
    }
    await q.resolveReport(db, {
      id,
      status: 'accepted',
      resolvedBy: adminId,
      exerciseId: exercise.id,
    });
  });
  return getReport(pool, id);
}

/** Whether the stored exercise's grader already takes the answer (a near-miss counts). */
function alreadyAccepted(
  exercise: { type: string; payload: JsonObject },
  answer: string,
  plugin: LanguagePlugin,
): boolean {
  try {
    return gradeResponse(exercise, { attempts: [answer] }, plugin).result !== 'wrong';
  } catch {
    // A payload or answer the grader rejects: add the answer, and let the schema decide.
    return false;
  }
}

/** FR-229: dismisses the report; the exercise stays as it is. */
export async function dismissReport(
  pool: Pool,
  adminId: ScopedUserId,
  id: number,
): Promise<AnswerReport> {
  await withTransaction(pool, async (db) => {
    await q.lockResolving(db);
    await openReport(db, id);
    await q.resolveReport(db, { id, status: 'dismissed', resolvedBy: adminId });
  });
  return getReport(pool, id);
}

import type { Queryable } from '../../db/db';
import { insertReturning, query } from '../../db/db';
import type { ItemProgressRow, ReviewLogRow, Stage } from './rows';

// Hand-written, parameterized SQL for review progress and the review log. The log is
// append-only (DR-04): there are no UPDATE or DELETE statements against review_log, and the
// database rejects them. Review session queries are added by the issues that need them.

export interface NewItemProgress {
  userId: number;
  itemId: number;
  facet: string;
  stage: Stage;
  /** Null only for stage 8 (Retired). */
  dueAt: Date | null;
}

export function insertItemProgress(db: Queryable, p: NewItemProgress): Promise<ItemProgressRow> {
  return insertReturning<ItemProgressRow>(
    db,
    `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [p.userId, p.itemId, p.facet, p.stage, p.dueAt],
  );
}

/**
 * SDD section 7: due item facets for one learner, oldest due first. Served by
 * item_progress_user_due_idx (user_id, due_at). Exported so tests can EXPLAIN it.
 */
export const DUE_FACETS_SQL = `SELECT * FROM item_progress
  WHERE user_id = $1 AND due_at <= $2
  ORDER BY due_at
  LIMIT $3`;

export function listDueFacets(
  db: Queryable,
  userId: number,
  now: Date,
  limit: number,
): Promise<ItemProgressRow[]> {
  return query<ItemProgressRow>(db, DUE_FACETS_SQL, [userId, now, limit]);
}

export interface NewReviewLog {
  userId: number;
  itemId: number;
  facet: string;
  exerciseType: string;
  correct: boolean;
  stageBefore: Stage;
  stageAfter: Stage;
}

export function insertReviewLog(db: Queryable, r: NewReviewLog): Promise<ReviewLogRow> {
  return insertReturning<ReviewLogRow>(
    db,
    `INSERT INTO review_log
       (user_id, item_id, facet, exercise_type, correct, stage_before, stage_after)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [r.userId, r.itemId, r.facet, r.exerciseType, r.correct, r.stageBefore, r.stageAfter],
  );
}

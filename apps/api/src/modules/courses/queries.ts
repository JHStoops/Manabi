import type { Queryable } from '../../db/db';
import { insertReturning } from '../../db/db';
import type { XpEventRow } from './rows';

// Hand-written, parameterized SQL for enrollments and the XP ledger. The ledger is append-only
// (DR-04): there are no UPDATE or DELETE statements against xp_events, and the database rejects
// them. Award, streak and rebuild queries are added by the issues that need them.

export interface NewXpEvent {
  userId: number;
  courseId: number;
  baseAmount: number;
  multiplier: number;
  amount: number;
  reason: string;
  refId: number | null;
  earnedAt: Date;
  /** DR-05: the learner's calendar date at earnedAt, 'YYYY-MM-DD'. */
  localDate: string;
}

export function insertXpEvent(db: Queryable, e: NewXpEvent): Promise<XpEventRow> {
  return insertReturning<XpEventRow>(
    db,
    `INSERT INTO xp_events
       (user_id, course_id, base_amount, multiplier, amount, reason, ref_id, earned_at, local_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      e.userId,
      e.courseId,
      e.baseAmount,
      e.multiplier,
      e.amount,
      e.reason,
      e.refId,
      e.earnedAt,
      e.localDate,
    ],
  );
}

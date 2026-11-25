import { RETIRED_STAGE, type Stage } from './progress';

/**
 * SRS scheduler (FR-111, FR-112; Product Spec section 7, SDD section 7). Pure; the API applies it
 * inside the review transaction and records each answer in review_log.
 */

/**
 * FR-111: hours until the next review at stages 1 to 7 (4h, 1d, 3d, 1w, 2w, 1mo, 4mo); stage 8 is
 * Retired and never due. A month is 30 days. The server reads its table from SRS_INTERVAL_HOURS.
 */
export const DEFAULT_SRS_INTERVAL_HOURS: readonly number[] = [4, 24, 72, 168, 336, 720, 2880];

/** The next stage and due time; `dueAt` is null exactly at the retired stage. */
export interface ScheduleResult {
  stage: Stage;
  dueAt: Date | null;
}

/** SDD section 7: current state plus a review outcome gives the next stage and due time. */
export interface Scheduler {
  next(stage: Stage, correct: boolean, now: Date): ScheduleResult;
}

/** FR-112: one stage up when correct; down 1 from stages 1 to 4, down 2 from 5 and above. */
export class FixedLadderScheduler implements Scheduler {
  /** `intervalHours[i]` is the wait after landing on stage i + 1; one entry per stage 1 to 7. */
  constructor(private readonly intervalHours: readonly number[] = DEFAULT_SRS_INTERVAL_HOURS) {
    if (intervalHours.length !== RETIRED_STAGE - 1 || !intervalHours.every((h) => h > 0)) {
      throw new Error(`Expected ${RETIRED_STAGE - 1} positive interval hours`);
    }
  }

  next(stage: Stage, correct: boolean, now: Date): ScheduleResult {
    if (stage === RETIRED_STAGE) return { stage, dueAt: null };
    const nextStage = correct ? stage + 1 : Math.max(1, stage - (stage >= 5 ? 2 : 1));
    if (nextStage === RETIRED_STAGE) return { stage: nextStage, dueAt: null };
    const hours = this.intervalHours[nextStage - 1] as number;
    return { stage: nextStage, dueAt: new Date(now.getTime() + hours * 3_600_000) };
  }
}

/**
 * FR-112: an item's outcome for a session from its facets' answers (undefined = not answered yet).
 * Wrong if any facet was wrong, correct only when every facet was answered correctly, otherwise
 * null: not settled, so the item keeps its stage (the learner stopped before finishing it).
 */
export function combineFacets(answers: readonly (boolean | undefined)[]): boolean | null {
  if (answers.includes(false)) return false;
  return answers.length > 0 && answers.every((a) => a === true) ? true : null;
}

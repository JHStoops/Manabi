-- Up Migration
-- FR-054, FR-229 (#63): the lesson a report was filed from, so accepting a report on a
-- session-generated exercise pins it into that lesson (where the learner met it) before adding
-- the answer to its accept list. Null for reports from reviews and unit test-outs: accepting one of
-- those pins an item-level exercise, which reviews use. A generated exercise answered in English
-- names no item in its payload, so the lesson alone is also a target.
-- NFR-52: forward-only. This file has no Down Migration section on purpose.
ALTER TABLE answer_reports
  ADD COLUMN lesson_id bigint REFERENCES lessons (id) ON DELETE RESTRICT,
  DROP CONSTRAINT answer_reports_has_target,
  ADD CONSTRAINT answer_reports_has_target
    CHECK (exercise_id IS NOT NULL OR item_id IS NOT NULL OR lesson_id IS NOT NULL);
CREATE INDEX answer_reports_lesson_idx ON answer_reports (lesson_id) WHERE lesson_id IS NOT NULL;

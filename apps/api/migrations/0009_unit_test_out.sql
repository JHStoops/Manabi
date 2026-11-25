-- Up Migration
-- FR-024, FR-021: unit test-out. A test-out session is a lesson_sessions row for a unit instead of
-- a lesson (SDD section 5: unit_id set, no lesson_id). A passed test-out writes the unit's
-- completion with tested_out true, which also opens every lesson of the unit (lessonStates).
ALTER TABLE lesson_sessions
  ALTER COLUMN lesson_id DROP NOT NULL,
  ADD COLUMN unit_id bigint REFERENCES units (id) ON DELETE RESTRICT,
  ADD CONSTRAINT lesson_sessions_lesson_or_unit CHECK ((lesson_id IS NULL) <> (unit_id IS NULL));
-- Start-or-resume looks up the learner's open session for a unit.
CREATE INDEX lesson_sessions_user_unit_idx ON lesson_sessions (user_id, unit_id);

ALTER TABLE unit_completions
  ADD COLUMN tested_out boolean NOT NULL DEFAULT false;

-- Up Migration
-- FR-227, SDD section 4: authored exercises come from the content pack's unit files. Each has a
-- key unique within its lesson, so re-import updates it in place, and a position in the lesson.
-- An exercise dropped from the pack is archived, not deleted, since answer_reports.exercise_id
-- is ON DELETE RESTRICT. Generated and pinned exercises have no key.
ALTER TABLE exercises
  ADD COLUMN key         text CHECK (key <> ''),
  ADD COLUMN position    integer CHECK (position >= 0),
  ADD COLUMN archived_at timestamptz,
  ADD CONSTRAINT exercises_lesson_key_unique UNIQUE (lesson_id, key);

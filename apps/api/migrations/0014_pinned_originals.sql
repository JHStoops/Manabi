-- Up Migration
-- FR-229, FR-114 (#254): a pinned exercise records the generated original it was made from (its
-- payload without the accept list; the type is the pin's, which never changes). Lesson and review
-- building match a pin to its original on this column instead of on the pin's live payload, so a
-- pin an author edits (for example its prompt) still takes its original's place instead of being
-- served next to it. Null only for exercises that are not pins.
-- Backfill for existing pins: the payload of the pin's first answer report (the generated
-- exercise as the learner saw it when the report that pinned it was filed), else the pin's own
-- payload. Content rows only; no progress table is touched.
-- NFR-52: forward-only. This file has no Down Migration section on purpose.
ALTER TABLE exercises
  ADD COLUMN original_payload jsonb
    CONSTRAINT exercises_original_payload_object
      CHECK (original_payload IS NULL OR jsonb_typeof(original_payload) = 'object')
    CONSTRAINT exercises_original_payload_only_pins
      CHECK (original_payload IS NULL OR origin = 'pinned');

UPDATE exercises e
   SET original_payload = coalesce(
         (SELECT r.exercise_payload
            FROM answer_reports r
           WHERE r.exercise_id = e.id AND r.exercise_type = e.type
           ORDER BY r.id
           LIMIT 1),
         e.payload) - 'accept'
 WHERE e.origin = 'pinned';

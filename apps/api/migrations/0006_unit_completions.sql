-- Up Migration
-- FR-021, FR-232: a unit the learner has finished (every lesson completed, or tested out). Stored
-- rather than derived, so lessons later added to or published in the unit never re-lock the next
-- one. Insert-only: written by the lesson-completion and test-out transactions, never updated.
-- DR-03, DR-07: content is RESTRICTed, the user's rows go with the user.
CREATE TABLE unit_completions (
  user_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  unit_id      bigint NOT NULL REFERENCES units (id) ON DELETE RESTRICT,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, unit_id)
);

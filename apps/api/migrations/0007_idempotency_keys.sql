-- Up Migration
-- FR-052, SDD section 8: the Idempotency-Key of a write that awards progress, with the response it
-- got, so a retry is answered from here instead of being applied again. Written in the same
-- transaction as the progress, so a failed request leaves no key behind (NFR-20). Keys are per
-- learner (NFR-14). DR-07: the user's keys go with the user.
-- shortcut: rows are never purged; add them to the DR-08 retention job if the table grows large.
CREATE TABLE idempotency_keys (
  user_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key          text NOT NULL,
  -- Hash of the request; the same key sent with a different request is refused.
  request_hash text NOT NULL,
  response     jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

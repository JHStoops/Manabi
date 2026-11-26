-- Up Migration
-- FR-114: a review session of up to 20 due items, answered one exercise at a time. Its state
-- holds the exercises and the answers so far; each answer is applied to item_progress and
-- review_log as it is given, so an abandoned session loses nothing. One open session per
-- learner; it is resumable until expires_at (24 hours), then purged (DR-08).
CREATE TABLE review_sessions (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  state      jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT review_sessions_expires_after_created CHECK (expires_at > created_at)
);
CREATE INDEX review_sessions_expires_idx ON review_sessions (expires_at);

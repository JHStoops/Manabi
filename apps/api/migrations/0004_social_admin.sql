-- Up Migration
-- Social and admin tables (SDD section 5, Data model: Social and admin).
-- NFR-52: forward-only. This file has no Down Migration section on purpose.
-- DR-07: deleting a user removes their follows, nudges, weekly results and achievements
-- (ON DELETE CASCADE) and anonymizes their answer reports (ON DELETE SET NULL).

-- FR-182: one-way follows; no approval needed.
CREATE TABLE follows (
  follower_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  followee_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT follows_not_self CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee_idx ON follows (followee_id);

-- FR-183: in-app nudges, at most one per sender, recipient and day. The day is the sender's
-- calendar date in their time zone, computed like xp_events.local_date.
CREATE TABLE nudges (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  to_user_id   bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('nice_work', 'keep_going')),
  sent_at      timestamptz NOT NULL DEFAULT now(),
  local_date   date NOT NULL,
  seen_at      timestamptz,
  CONSTRAINT nudges_not_self CHECK (from_user_id <> to_user_id),
  CONSTRAINT nudges_one_per_day_key UNIQUE (from_user_id, to_user_id, local_date),
  -- Every zone is within a day of UTC, which bounds the sender's local date.
  CONSTRAINT nudges_local_date_near_utc
    CHECK (local_date BETWEEN (sent_at AT TIME ZONE 'UTC')::date - 1
                          AND (sent_at AT TIME ZONE 'UTC')::date + 1)
);
-- A learner's nudges, newest first, read on app load (unseen ones filtered by seen_at).
CREATE INDEX nudges_to_sent_idx ON nudges (to_user_id, sent_at);

-- FR-181: final weekly ranks, written at the Sunday 23:59 rollover. Ties share a rank.
CREATE TABLE weekly_results (
  -- Monday that starts the week, in the server's time zone.
  week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  xp         integer NOT NULL CHECK (xp >= 0),
  rank       integer NOT NULL CHECK (rank >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (week_start, user_id)
);
-- Profile badges (top three) per learner.
CREATE INDEX weekly_results_user_idx ON weekly_results (user_id, week_start);

-- FR-165: seeded achievement definitions. Definitions are data: a metric and a threshold
-- (SDD section 7). group_key is the SDD's `group` (a reserved word in SQL): streak, kanji,
-- vocabulary, grammar, course, effort, drawing.
CREATE TABLE achievements (
  key        stable_key PRIMARY KEY,
  group_key  text NOT NULL CHECK (group_key ~ '^[a-z][a-z0-9_]*$'),
  -- Metric name the progress service computes (for example 'streak_days').
  metric     stable_key NOT NULL,
  threshold  integer NOT NULL CHECK (threshold > 0),
  title      text NOT NULL CHECK (title <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_achievements (
  user_id         bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  achievement_key stable_key NOT NULL REFERENCES achievements (key) ON DELETE RESTRICT,
  earned_at       timestamptz NOT NULL DEFAULT now(),
  -- FR-165: the celebration is shown once; set when the client has shown it.
  seen_at         timestamptz,
  PRIMARY KEY (user_id, achievement_key)
);

-- FR-054, FR-229: the author inbox. user_id is null once the reporter's account is deleted.
-- Exercises generated for a session live only in lesson_sessions.state (SDD section 6), so a
-- report keeps its own copy of the exercise (type and payload) and points at the stored
-- exercise when there is one, and at the item it practises.
CREATE TABLE answer_reports (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          bigint REFERENCES users (id) ON DELETE SET NULL,
  -- Null for session-generated exercises; set when accepting the report pins one (FR-229).
  exercise_id      bigint REFERENCES exercises (id) ON DELETE RESTRICT,
  item_id          bigint REFERENCES items (id) ON DELETE RESTRICT,
  -- Exercise type id from the exercise registry, and the payload as the learner saw it.
  exercise_type    text NOT NULL CHECK (exercise_type ~ '^[a-z][a-z0-9_]*$'),
  exercise_payload jsonb NOT NULL CHECK (jsonb_typeof(exercise_payload) = 'object'),
  given_answer     text NOT NULL CHECK (given_answer <> ''),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'dismissed')),
  -- The admin who resolved it; null while open or once that account is deleted.
  resolved_by  bigint REFERENCES users (id) ON DELETE SET NULL,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT answer_reports_resolved_when_closed CHECK ((status = 'open') = (resolved_at IS NULL)),
  CONSTRAINT answer_reports_resolver_needs_resolution
    CHECK (resolved_by IS NULL OR resolved_at IS NOT NULL),
  CONSTRAINT answer_reports_has_target CHECK (exercise_id IS NOT NULL OR item_id IS NOT NULL)
);
-- The inbox lists open reports, oldest first (FR-201 counts them).
CREATE INDEX answer_reports_open_idx ON answer_reports (created_at) WHERE status = 'open';
CREATE INDEX answer_reports_exercise_idx ON answer_reports (exercise_id)
  WHERE exercise_id IS NOT NULL;
CREATE INDEX answer_reports_item_idx ON answer_reports (item_id) WHERE item_id IS NOT NULL;

-- FR-226: one row per dataset import run. Importer ids come from packages/importers.
CREATE TABLE import_runs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  importer    text NOT NULL CHECK (importer ~ '^[a-z][a-z0-9_-]*$'),
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  -- Counts, dataset version, errors; shape defined by the importer.
  summary     jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(summary) = 'object'),
  CONSTRAINT import_runs_finished_when_done CHECK ((status = 'running') = (finished_at IS NULL)),
  CONSTRAINT import_runs_finished_after_start CHECK (finished_at IS NULL OR finished_at >= started_at)
);
CREATE INDEX import_runs_importer_started_idx ON import_runs (importer, started_at);

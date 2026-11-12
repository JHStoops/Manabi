-- Up Migration
-- Progress tables (SDD section 5, Data model: Progress; SDD section 7, Progress logic).
-- NFR-52: forward-only. This file has no Down Migration section on purpose.
-- DR-03: progress references content by id only, with ON DELETE RESTRICT toward content. Content
-- is archived, never deleted, and re-imports update rows in place, so progress survives content
-- edits, re-imports and republishing (FR-232). Content imports never write to these tables.
-- DR-07: deleting a user removes all of their progress rows (ON DELETE CASCADE from users).
-- DR-05: timestamps are timestamptz (UTC); xp_events also stores the learner's local date.

-- Needed by the boosters exclusion constraint (bigint equality inside a GiST index).
-- A trusted extension shipped with the official PostgreSQL image.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- FR-023, FR-162: XP total and level per course. Both are a cache of xp_events (DR-04), updated
-- in the same transaction as each award and rebuildable from the ledger.
CREATE TABLE enrollments (
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id  bigint NOT NULL REFERENCES courses (id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  total_xp   integer NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level      integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  PRIMARY KEY (user_id, course_id)
);
CREATE INDEX enrollments_course_idx ON enrollments (course_id);

-- FR-020, FR-021, FR-055: a row exists once the lesson has been completed at least once.
CREATE TABLE lesson_progress (
  user_id         bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  lesson_id       bigint NOT NULL REFERENCES lessons (id) ON DELETE RESTRICT,
  -- First completion.
  completed_at    timestamptz NOT NULL,
  -- Best accuracy over all completions, as a whole percentage.
  best_accuracy   smallint NOT NULL CHECK (best_accuracy BETWEEN 0 AND 100),
  times_completed integer NOT NULL DEFAULT 1 CHECK (times_completed >= 1),
  PRIMARY KEY (user_id, lesson_id)
);

-- FR-050: an unfinished lesson session, resumable until expires_at (24 hours); then purged (DR-08).
CREATE TABLE lesson_sessions (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  lesson_id  bigint NOT NULL REFERENCES lessons (id) ON DELETE RESTRICT,
  -- Teaching cards, ordered exercises with payloads and accept lists, responses so far.
  state      jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT lesson_sessions_expires_after_created CHECK (expires_at > created_at)
);
-- Start-or-resume looks up the learner's open session for a lesson.
CREATE INDEX lesson_sessions_user_lesson_idx ON lesson_sessions (user_id, lesson_id);
CREATE INDEX lesson_sessions_expires_idx ON lesson_sessions (expires_at);

-- FR-110 to FR-116: one row per item and review facet. Facets come from the language plugin
-- (FR-240), so they are format-checked only. Stages 1 to 7 are on the ladder; stage 8 is
-- Retired (Product Spec section 7) and is never due, so due_at is null exactly at stage 8.
CREATE TABLE item_progress (
  user_id          bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  item_id          bigint NOT NULL REFERENCES items (id) ON DELETE RESTRICT,
  facet            text NOT NULL CHECK (facet ~ '^[a-z][a-z0-9_]*$'),
  stage            smallint NOT NULL CHECK (stage BETWEEN 1 AND 8),
  due_at           timestamptz,
  last_reviewed_at timestamptz,
  correct_count    integer NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  wrong_count      integer NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id, facet),
  CONSTRAINT item_progress_due_unless_retired CHECK ((stage = 8) = (due_at IS NULL))
);
-- SDD section 7: due items and the 7-day forecast come from one indexed query on this index.
CREATE INDEX item_progress_user_due_idx ON item_progress (user_id, due_at);
-- Per-item lookups across learners (admin and author views) and the RESTRICT check on items.
CREATE INDEX item_progress_item_idx ON item_progress (item_id);

-- FR-117, DR-04: every review answer, append-only (see the triggers at the end of this file).
-- Keeps enough history for a future adaptive scheduler. NFR-06: sized for 5 million rows.
CREATE TABLE review_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  item_id       bigint NOT NULL REFERENCES items (id) ON DELETE RESTRICT,
  facet         text NOT NULL CHECK (facet ~ '^[a-z][a-z0-9_]*$'),
  -- Exercise type id from the exercise registry.
  exercise_type text NOT NULL CHECK (exercise_type ~ '^[a-z][a-z0-9_]*$'),
  -- False only when the second attempt also failed (FR-046).
  correct       boolean NOT NULL,
  stage_before  smallint NOT NULL CHECK (stage_before BETWEEN 1 AND 8),
  stage_after   smallint NOT NULL CHECK (stage_after BETWEEN 1 AND 8),
  answered_at   timestamptz NOT NULL DEFAULT now()
);
-- A learner's history (stats, export DR-10, "100 reviews in a day").
CREATE INDEX review_log_user_answered_idx ON review_log (user_id, answered_at);
-- Per-item history across learners (scheduler tuning) and the RESTRICT check on items.
CREATE INDEX review_log_item_idx ON review_log (item_id);
-- Server-wide activity per day (FR-201). Rows arrive in time order, so a BRIN index stays tiny.
CREATE INDEX review_log_answered_brin ON review_log USING brin (answered_at);

-- FR-160, FR-170, DR-04: the XP ledger, append-only and the source of truth for XP.
-- amount = base_amount times the active booster's multiplier, rounded by the XP rules in core.
CREATE TABLE xp_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id   bigint NOT NULL REFERENCES courses (id) ON DELETE RESTRICT,
  base_amount integer NOT NULL CHECK (base_amount > 0),
  multiplier  numeric(4, 2) NOT NULL DEFAULT 1 CHECK (multiplier >= 1),
  amount      integer NOT NULL,
  -- Reason code from the XP rules table in core (for example 'lesson_new', 'review_correct').
  reason      text NOT NULL CHECK (reason ~ '^[a-z][a-z0-9_]*$'),
  -- Id of what earned it (lesson, review log row, unit); its table depends on the reason.
  ref_id      bigint,
  earned_at   timestamptz NOT NULL DEFAULT now(),
  -- DR-05: the learner's calendar date at earned_at in users.time_zone, kept even if the zone
  -- changes later. Every zone is within a day of UTC, which bounds it.
  local_date  date NOT NULL,
  CONSTRAINT xp_events_amount_not_below_base CHECK (amount >= base_amount),
  CONSTRAINT xp_events_local_date_near_utc
    CHECK (local_date BETWEEN (earned_at AT TIME ZONE 'UTC')::date - 1
                          AND (earned_at AT TIME ZONE 'UTC')::date + 1)
);
-- Streak and daily goal: the learner's XP on one local date, across courses (FR-161, FR-163).
CREATE INDEX xp_events_user_local_date_idx ON xp_events (user_id, local_date);
-- Rebuilding enrollments.total_xp per course.
CREATE INDEX xp_events_user_course_idx ON xp_events (user_id, course_id);
-- The live weekly leaderboard aggregates the current week (FR-180).
CREATE INDEX xp_events_earned_idx ON xp_events (earned_at);

-- FR-163, FR-164: streak cache across all courses, rebuildable from xp_events.
CREATE TABLE user_stats (
  user_id          bigint PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  current_streak   integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak   integer NOT NULL DEFAULT 0,
  -- A learner holds at most 2 streak freezes (FR-164).
  freezes          smallint NOT NULL DEFAULT 0 CHECK (freezes BETWEEN 0 AND 2),
  last_active_date date,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_stats_longest_at_least_current CHECK (longest_streak >= current_streak)
);

-- Personal mnemonics (Product Spec section 8), private to the learner.
CREATE TABLE user_notes (
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  item_id    bigint NOT NULL REFERENCES items (id) ON DELETE RESTRICT,
  body       text NOT NULL CHECK (body <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- FR-169: timed XP boosters. The active one covers now() in [started_at, ends_at). Replacing a
-- booster ends the running one at now() before the new one starts; extending moves ends_at.
-- The exclusion constraint guarantees at most one active booster per learner at any instant.
CREATE TABLE boosters (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  multiplier numeric(4, 2) NOT NULL CHECK (multiplier > 1),
  -- Trigger code from configuration (for example 'perfect_lesson', 'daily_goal').
  reason     text NOT NULL CHECK (reason ~ '^[a-z][a-z0-9_]*$'),
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz NOT NULL,
  CONSTRAINT boosters_ends_after_start CHECK (ends_at > started_at),
  CONSTRAINT boosters_one_active_per_user
    EXCLUDE USING gist (user_id WITH =, tstzrange(started_at, ends_at) WITH &&)
);

-- DR-04: review_log and xp_events are append-only. UPDATE is always rejected. DELETE is rejected
-- unless the owning user no longer exists, which happens only when the account is deleted and
-- ON DELETE CASCADE removes the rows (DR-07). TRUNCATE is rejected unless `manabi.allow_truncate`
-- holds the current transaction's id (set_config(..., pg_current_xact_id()::text, true)), so the
-- permission cannot outlive the transaction that asked for it, even if set at session level.
-- Only the test harness does that, between tests.
-- The app connects as the database owner (SDD section 12 has no separate app role), so these
-- triggers, not grants, are what enforce the rule.
CREATE FUNCTION reject_append_only_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;

CREATE FUNCTION reject_append_only_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('manabi.allow_truncate', true) = pg_current_xact_id()::text THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION '% is append-only: TRUNCATE is not allowed', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END
$$;

CREATE TRIGGER review_log_append_only
  BEFORE UPDATE OR DELETE ON review_log
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
CREATE TRIGGER review_log_no_truncate
  BEFORE TRUNCATE ON review_log
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_truncate();

CREATE TRIGGER xp_events_append_only
  BEFORE UPDATE OR DELETE ON xp_events
  FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
CREATE TRIGGER xp_events_no_truncate
  BEFORE TRUNCATE ON xp_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_append_only_truncate();

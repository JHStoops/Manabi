-- Up Migration
-- Account tables (SDD section 5, Data model: Accounts; SDD section 11).
-- NFR-52: forward-only. This file has no Down Migration section on purpose.
-- NFR-61: the only personal data stored is username, display name, email, time zone, settings
-- and learning activity. Do not add personal columns (real names, IP addresses, user agents).
-- NFR-10: passwords are stored only as Argon2id hashes, tokens only as hashes. The CHECKs below
-- reject anything else: a password hash must be an Argon2id PHC string, and a token hash must be
-- 64 lowercase hex characters (SHA-256 of the random token). Raw tokens never reach the database.
-- DR-07: deleting a user removes their sessions and reset tokens (ON DELETE CASCADE); references
-- that only record who did something (invite creator, invite user) are set to null.

-- Two account types only (FR-006). There is no separate author role.
CREATE TABLE users (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Sign-in is by username or email (FR-003), so a username cannot contain '@'.
  username             text NOT NULL CHECK (username ~ '^[^[:space:]@]{1,64}$'),
  -- Optional: the first admin (FR-009) and invites without email (IF-10) may have none.
  email                text CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+$'
                                   AND char_length(email) <= 254),
  password_hash        text NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  display_name         text NOT NULL CHECK (display_name <> ''),
  role                 text NOT NULL DEFAULT 'learner' CHECK (role IN ('admin', 'learner')),
  -- An admin-set temporary password (FR-005) sets must_change_password and an expiry 7 days out
  -- (SDD section 11); choosing a new password clears both.
  must_change_password boolean NOT NULL DEFAULT false,
  password_expires_at  timestamptz,
  -- IANA zone name such as 'Asia/Tokyo'; validated by the API. Used for xp_events.local_date.
  time_zone            text NOT NULL CHECK (time_zone <> ''),
  -- Theme, furigana mode, caps, toggles (Product Spec section 11); shape validated by Zod.
  settings             jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(settings) = 'object'),
  -- FR-200: a disabled account cannot sign in; its data is kept.
  disabled_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_password_expiry_needs_change
    CHECK (password_expires_at IS NULL OR must_change_password)
);
-- Usernames and emails are unique regardless of case, since sign-in matches either.
CREATE UNIQUE INDEX users_username_key ON users (lower(username));
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- FR-001, FR-002: single-use invites with an account type and expiry; revocable.
CREATE TABLE invites (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- Address the link was emailed to; null when the admin only copied the link (IF-10).
  email      text CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+$' AND char_length(email) <= 254),
  role       text NOT NULL DEFAULT 'learner' CHECK (role IN ('admin', 'learner')),
  created_by bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_by    bigint REFERENCES users (id) ON DELETE SET NULL,
  used_at    timestamptz,
  revoked_at timestamptz,
  CONSTRAINT invites_expires_after_created CHECK (expires_at > created_at),
  -- used_by becomes null if that account is later deleted; used_at stays.
  CONSTRAINT invites_used_by_needs_used_at CHECK (used_by IS NULL OR used_at IS NOT NULL),
  CONSTRAINT invites_used_or_revoked CHECK (used_at IS NULL OR revoked_at IS NULL)
);
-- DR-08: the purge job deletes expired invites.
CREATE INDEX invites_expires_idx ON invites (expires_at);

-- FR-003, FR-004: one row per signed-in device; 30-day sliding expiry (expires_at moves forward).
CREATE TABLE sessions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- Cookie (web) or bearer token (mobile), IF-06.
  client_kind  text NOT NULL CHECK (client_kind IN ('web', 'mobile')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  CONSTRAINT sessions_expires_after_created CHECK (expires_at > created_at)
);
-- Listing and revoking a user's sessions (FR-004; all revoked on password change).
CREATE INDEX sessions_user_idx ON sessions (user_id);
-- DR-08: the purge job deletes expired sessions.
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- FR-005: single-use reset links, requested by the learner (sent by email) or issued by an admin
-- (shown to the admin to pass on).
CREATE TABLE password_resets (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  origin     text NOT NULL CHECK (origin IN ('email', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  CONSTRAINT password_resets_expires_after_created CHECK (expires_at > created_at)
);
CREATE INDEX password_resets_user_idx ON password_resets (user_id);
-- DR-08: the purge job deletes expired reset tokens.
CREATE INDEX password_resets_expires_idx ON password_resets (expires_at);

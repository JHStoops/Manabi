-- Up Migration
-- Content tables (SDD section 5, Data model: Content).
-- NFR-52: forward-only. This file has no Down Migration section on purpose.
-- DR-01: all persistent state lives in PostgreSQL.

-- Level codes such as 'kana', 'N5', 'N4' (sections, items, sentences).
CREATE DOMAIN level_code AS text
  CHECK (VALUE ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$');

-- Stable keys such as 'ja-en', 'ja:kanji:水', 'ja:word:水:みず' (DR-02). No whitespace.
CREATE DOMAIN stable_key AS text
  CHECK (VALUE ~ '^\S+$' AND char_length(VALUE) <= 200);

CREATE TABLE courses (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key         stable_key NOT NULL UNIQUE,
  target_lang text NOT NULL CHECK (target_lang ~ '^[a-z]{2,3}$'),
  base_lang   text NOT NULL CHECK (base_lang ~ '^[a-z]{2,3}$'),
  plugin      text NOT NULL CHECK (plugin ~ '^[a-z][a-z0-9-]*$'),
  title       text NOT NULL CHECK (title <> ''),
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sections (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id  bigint NOT NULL REFERENCES courses (id),
  key        stable_key NOT NULL UNIQUE,
  position   integer NOT NULL CHECK (position >= 0),
  title      text NOT NULL CHECK (title <> ''),
  level_code level_code NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Deferrable so a reorder can swap positions inside one transaction.
  CONSTRAINT sections_course_position_key UNIQUE (course_id, position) DEFERRABLE INITIALLY DEFERRED
);

-- FR-225: draft and published states per unit and lesson.
-- Units and lessons dropped from a pack are archived, never deleted (SDD section 4).
CREATE TABLE units (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section_id  bigint NOT NULL REFERENCES sections (id),
  key         stable_key NOT NULL UNIQUE,
  position    integer NOT NULL CHECK (position >= 0),
  title       text NOT NULL CHECK (title <> ''),
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT units_section_position_key UNIQUE (section_id, position) DEFERRABLE INITIALLY DEFERRED
);

-- FR-040: the six lesson types.
CREATE TABLE lessons (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unit_id     bigint NOT NULL REFERENCES units (id),
  key         stable_key NOT NULL UNIQUE,
  position    integer NOT NULL CHECK (position >= 0),
  type        text NOT NULL
              CHECK (type IN ('kana', 'vocabulary', 'kanji', 'grammar', 'listening', 'unit_review')),
  title       text NOT NULL CHECK (title <> ''),
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lessons_unit_position_key UNIQUE (unit_id, position) DEFERRABLE INITIALLY DEFERRED
);

-- DR-02: key is stable and unique. DR-06: data holds plugin-validated, language-specific fields.
-- DR-09: imported values (data, source, dataset_version) and author overrides are separate columns.
-- The item type set comes from the language plugin's itemSchemas, so it is format-checked only.
CREATE TABLE items (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id       bigint NOT NULL REFERENCES courses (id),
  key             stable_key NOT NULL,
  type            text NOT NULL CHECK (type ~ '^[a-z][a-z0-9_]*$'),
  level_code      level_code,
  data            jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(data) = 'object'),
  overrides       jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(overrides) = 'object'),
  -- Dataset the imported values came from (for example 'kanjidic2'); null for authored items.
  source          text CHECK (source <> ''),
  dataset_version text CHECK (dataset_version <> ''),
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT items_key_key UNIQUE (key),
  CONSTRAINT items_dataset_version_needs_source CHECK (dataset_version IS NULL OR source IS NOT NULL)
);
CREATE INDEX items_course_type_idx ON items (course_id, type);
CREATE INDEX items_course_level_idx ON items (course_id, level_code);

CREATE TABLE item_links (
  from_item_id bigint NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  to_item_id   bigint NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  -- contains: word contains kanji; related: grammar related to grammar; component: kanji has component.
  kind         text NOT NULL CHECK (kind IN ('contains', 'related', 'component')),
  PRIMARY KEY (from_item_id, to_item_id, kind),
  CHECK (from_item_id <> to_item_id)
);
CREATE INDEX item_links_to_idx ON item_links (to_item_id);

CREATE TABLE lesson_items (
  lesson_id bigint NOT NULL REFERENCES lessons (id) ON DELETE CASCADE,
  item_id   bigint NOT NULL REFERENCES items (id),
  position  integer NOT NULL CHECK (position >= 0),
  PRIMARY KEY (lesson_id, item_id),
  CONSTRAINT lesson_items_lesson_position_key UNIQUE (lesson_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX lesson_items_item_idx ON lesson_items (item_id);

-- DR-11: source id, owner, URL, licence and dataset version are stored separately for the
-- sentence and for its translation in `attribution` ({ "sentence": {...}, "translation": {...} }),
-- with separate edited flags. DR-12: tiles in `tokens`, review status, and detected grammar.
-- Sentences are never dropped for grammar level: `grammar_level_code` is the highest level among
-- the detected grammar points (null when none were detected), `level_code` is the vocabulary
-- level, and "challenging" is derived by comparing the two unless `challenge_override` is set.
CREATE TABLE sentences (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id          bigint NOT NULL REFERENCES courses (id),
  text               text NOT NULL CHECK (text <> ''),
  -- Tiles: [{ "surface", "base", "reading", "itemId" }]; the sentence reading is the readings joined.
  tokens             jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(tokens) = 'array'),
  translation        text NOT NULL CHECK (translation <> ''),
  -- Dataset (for example 'tatoeba') and its sentence id; both null for authored sentences.
  source             text CHECK (source <> ''),
  source_id          text CHECK (source_id <> ''),
  attribution        jsonb CHECK (jsonb_typeof(attribution) = 'object'),
  review_status      text NOT NULL DEFAULT 'unreviewed'
                     CHECK (review_status IN ('unreviewed', 'flagged', 'reviewed')),
  -- Grammar point keys detected at import.
  grammar            jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(grammar) = 'array'),
  level_code         level_code,
  grammar_level_code level_code,
  -- Null: derive "challenging" from the levels; true or false: author decision.
  challenge_override boolean,
  -- An author edit to the text sets `edited`; to the translation, `translation_edited` (DR-11).
  edited             boolean NOT NULL DEFAULT false,
  translation_edited boolean NOT NULL DEFAULT false,
  -- Tiles changed by an author are never overwritten on re-import (SDD section 10).
  tokens_edited      boolean NOT NULL DEFAULT false,
  archived_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sentences_source_pair CHECK ((source IS NULL) = (source_id IS NULL)),
  CONSTRAINT sentences_imported_have_attribution CHECK (source IS NULL OR attribution IS NOT NULL)
);
-- Re-imports update a sentence in place by its source id.
CREATE UNIQUE INDEX sentences_course_source_key ON sentences (course_id, source, source_id)
  WHERE source IS NOT NULL;
CREATE INDEX sentences_course_review_idx ON sentences (course_id, review_status);

CREATE TABLE sentence_items (
  sentence_id bigint NOT NULL REFERENCES sentences (id) ON DELETE CASCADE,
  item_id     bigint NOT NULL REFERENCES items (id) ON DELETE CASCADE,
  PRIMARY KEY (sentence_id, item_id)
);
CREATE INDEX sentence_items_item_idx ON sentence_items (item_id);

CREATE TABLE supplementary_words (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id  bigint NOT NULL REFERENCES courses (id),
  level_code level_code NOT NULL,
  written    text NOT NULL CHECK (written <> ''),
  reading    text NOT NULL CHECK (reading <> ''),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplementary_words_unique UNIQUE (course_id, written, reading)
);

CREATE TABLE blocked_words (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lang       text NOT NULL CHECK (lang ~ '^[a-z]{2,3}$'),
  word       text NOT NULL CHECK (word <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_words_unique UNIQUE (lang, word)
);

-- Exercise type ids come from the exercise registry, so they are format-checked only.
-- DR-12: authored answer text stores its tiles inside `payload`.
CREATE TABLE exercises (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_id  bigint REFERENCES lessons (id),
  item_id    bigint REFERENCES items (id),
  type       text NOT NULL CHECK (type ~ '^[a-z][a-z0-9_]*$'),
  payload    jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  origin     text NOT NULL CHECK (origin IN ('authored', 'generated', 'pinned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercises_has_owner CHECK (lesson_id IS NOT NULL OR item_id IS NOT NULL)
);
CREATE INDEX exercises_lesson_idx ON exercises (lesson_id) WHERE lesson_id IS NOT NULL;
CREATE INDEX exercises_item_idx ON exercises (item_id) WHERE item_id IS NOT NULL;

-- owner_id points at items.id or sentences.id depending on owner_type (no foreign key).
-- text_hash is the hash of the reading sent to the TTS engine; a mismatch means stale audio.
CREATE TABLE audio_assets (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_type text NOT NULL CHECK (owner_type IN ('item', 'sentence')),
  owner_id   bigint NOT NULL,
  voice      text NOT NULL CHECK (voice <> ''),
  path       text NOT NULL UNIQUE CHECK (path <> ''),
  origin     text NOT NULL CHECK (origin IN ('generated', 'uploaded')),
  text_hash  text NOT NULL CHECK (text_hash <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audio_assets_owner_voice_origin_key UNIQUE (owner_type, owner_id, voice, origin)
);

-- Hanzi Writer character data converted from KanjiVG: an outline and a median per stroke.
CREATE TABLE stroke_data (
  item_id    bigint PRIMARY KEY REFERENCES items (id) ON DELETE CASCADE,
  strokes    jsonb NOT NULL CHECK (jsonb_typeof(strokes) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

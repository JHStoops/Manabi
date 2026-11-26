-- Up Migration
-- FR-075, FR-092, NFR-01: library search and filters (#54). The columns hold the course
-- plugin's libraryFields for the item's merged data, written by the API on every item write.
-- search_text is null until written; the API fills null rows when it starts (existing items).
-- NFR-52: forward-only. This file has no Down Migration section on purpose.

-- Trigram index for substring search; a trusted extension shipped with the PostgreSQL image.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE items
  -- The plugin's folded search terms, one per line.
  ADD COLUMN search_text  text,
  ADD COLUMN stroke_count smallint CHECK (stroke_count > 0),
  ADD COLUMN radical      text CHECK (radical <> '');

CREATE INDEX items_search_trgm_idx ON items USING gin (search_text gin_trgm_ops);
CREATE INDEX items_course_stroke_count_idx ON items (course_id, stroke_count)
  WHERE stroke_count IS NOT NULL;
CREATE INDEX items_course_radical_idx ON items (course_id, radical) WHERE radical IS NOT NULL;

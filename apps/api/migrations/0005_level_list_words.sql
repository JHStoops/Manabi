-- Up Migration
-- Words of the JLPT level lists (SDD section 10 step 2), which the JMdict import filters on
-- (step 3) together with supplementary_words. Written by the level-list import only.
CREATE TABLE level_list_words (
  course_id  bigint NOT NULL REFERENCES courses (id),
  level_code level_code NOT NULL,
  written    text NOT NULL CHECK (written <> ''),
  reading    text NOT NULL CHECK (reading <> ''),
  PRIMARY KEY (course_id, written, reading)
);

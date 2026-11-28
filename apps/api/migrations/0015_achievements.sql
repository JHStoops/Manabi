-- Up Migration
-- FR-165 (#71): the achievement definitions from Product Spec section 9, seeded as data: a
-- metric and a threshold (SDD section 7). Metric names are documented in
-- packages/core/src/achievements.ts; an argument after ':' is data (an item type or a section's
-- level code), so the engine holds no language-specific rule. Adding or retuning an achievement
-- is a new migration. Definitions are reference data, not progress.
-- NFR-52: forward-only. This file has no Down Migration section on purpose.
ALTER TABLE achievements
  ADD CONSTRAINT achievements_group_key_known
    CHECK (group_key IN ('streak', 'kanji', 'vocabulary', 'grammar', 'course', 'effort', 'drawing'));

INSERT INTO achievements (key, group_key, metric, threshold, title) VALUES
  ('streak_7', 'streak', 'streak_days', 7, '7-day streak'),
  ('streak_30', 'streak', 'streak_days', 30, '30-day streak'),
  ('streak_100', 'streak', 'streak_days', 100, '100-day streak'),
  ('streak_365', 'streak', 'streak_days', 365, '365-day streak'),
  ('kanji_10', 'kanji', 'familiar_items:kanji', 10, '10 kanji at Familiar'),
  ('kanji_50', 'kanji', 'familiar_items:kanji', 50, '50 kanji at Familiar'),
  ('kanji_100', 'kanji', 'familiar_items:kanji', 100, '100 kanji at Familiar'),
  ('kanji_300', 'kanji', 'familiar_items:kanji', 300, '300 kanji at Familiar'),
  ('kanji_650', 'kanji', 'familiar_items:kanji', 650, '650 kanji at Familiar'),
  ('words_100', 'vocabulary', 'familiar_items:word', 100, '100 words at Familiar'),
  ('words_500', 'vocabulary', 'familiar_items:word', 500, '500 words at Familiar'),
  ('words_1000', 'vocabulary', 'familiar_items:word', 1000, '1,000 words at Familiar'),
  ('words_3000', 'vocabulary', 'familiar_items:word', 3000, '3,000 words at Familiar'),
  ('grammar_10', 'grammar', 'learned_items:grammar', 10, '10 grammar points learned'),
  ('grammar_50', 'grammar', 'learned_items:grammar', 50, '50 grammar points learned'),
  ('grammar_100', 'grammar', 'learned_items:grammar', 100, '100 grammar points learned'),
  ('section_kana', 'course', 'section_complete:kana', 1, 'Kana complete'),
  ('section_n5', 'course', 'section_complete:N5', 1, 'N5 complete'),
  ('section_n4', 'course', 'section_complete:N4', 1, 'N4 complete'),
  ('section_n3', 'course', 'section_complete:N3', 1, 'N3 complete'),
  ('first_perfect_lesson', 'effort', 'perfect_lessons', 1, 'First perfect lesson'),
  ('reviews_100_day', 'effort', 'reviews_in_day', 100, '100 reviews in a day'),
  ('xp_1000_week', 'effort', 'xp_in_week', 1000, '1,000 XP in a week'),
  ('drawn_100', 'drawing', 'characters_drawn', 100, '100 characters drawn from memory');

-- FR-165: characters a learner has drawn from memory (EX-12) in completed lessons, one row per
-- character, for the drawing achievement. Lessons keep no per-exercise log, so this is the
-- record; written only inside the lesson-completion transaction.
CREATE TABLE drawn_characters (
  user_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  item_id  bigint NOT NULL REFERENCES items (id) ON DELETE RESTRICT,
  drawn_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
-- The RESTRICT check on items.
CREATE INDEX drawn_characters_item_idx ON drawn_characters (item_id);

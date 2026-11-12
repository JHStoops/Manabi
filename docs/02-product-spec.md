# 2. Product Spec — Manabi

Source: https://claude.ai/artifact/QG8kuxZRFkwdbEmnLXPBq1, exported 2026-11-11

## 1. Scope

This spec describes what a learner and an admin see and do in Manabi v1, and the rules behind it. It turns the PRD's requirements (PR-n) into concrete behavior; the Software Design Document then decides how to build it.

Behavior is described for Japanese. Anything marked *language-specific* comes from the Japanese language plugin and would differ or be absent for another language.

## 2. App map

> Diagram: app map · 5 learner tabs plus the admin area. See the live document.

The five tabs sit in a bottom bar on phones and a side rail on wider screens. The lesson player and review session open full screen and hide the tabs until finished. The admin area appears as a sixth entry only for admins.

## 3. Course structure

A course is a path of sections, units and lessons built from reusable learning items (PR-1, PR-2).

| Level | What it is | Japanese example |
| --- | --- | --- |
| Course | One target language taught from one base language | Japanese for English speakers |
| Section | A stage of the course with its own color band on the path | Kana, N5, N4, N3 (N2 and N1 can be added later as more sections) |
| Unit | A themed group of 4 to 8 lessons ending in a unit review | "Food and ordering" |
| Lesson | One sitting of 10 to 15 exercises, 3 to 7 minutes | "Counting dishes" |
| Item | The thing being learned; shared across lessons, reviews and reference pages | A kana, a kanji, a word, a grammar point |

**Lesson types**

| Type | Teaches | Path icon color | Typical exercises |
| --- | --- | --- | --- |
| Kana | Hiragana or katakana in groups of 5 | Section color | Recognize, type romaji, trace, draw |
| Vocabulary | 5 to 7 new words | Blue | Choice, match pairs, word bank, listening |
| Kanji | 3 to 5 new kanji and the words that use them | Purple | Meaning, reading, stroke trace, draw |
| Grammar | One grammar point | Green | Fill the blank, reorder, conjugate, word bank |
| Listening | No new items; audio only | Orange | Listen and choose, dictation |
| Unit review | Mix of everything in the unit | Gold | All types |

**Rules**

- Lessons in a unit unlock in order; the next unit unlocks when every lesson in the current one is complete.
- A typical unit interleaves types: two vocabulary, one kanji, one grammar, one listening, then the unit review.
- Each unit has a "test out" (20 exercises, pass at 85%) that completes it without lessons (PR-5).
- Updating a course's content (for example adding N4 units to a course that had kana and N5) never resets or changes progress: completed lessons and units stay completed, review stages, XP, level and streak are untouched, and a lesson later added inside a finished unit appears as new without re-locking anything.
- Completed lessons can be replayed for practice at reduced XP.
- Lessons use only sentences whose words and grammar are at or below the section's level. Sentences whose words fit but whose grammar is one level higher are "challenge" sentences.
- A completed unit offers an optional **Challenge**: one extra lesson-style session built from the unit's challenge sentences, with the same exercises and feedback, XP as for a lesson (replay XP after the first time), and answers counting toward due reviews. It is not offered when the unit has fewer than 5 challenge sentences, and nothing waits on it.
- Every exercise uses only items already taught in this or an earlier lesson, plus the lesson's new items.

## 4. Lesson flow and exercise types

A lesson introduces its new items on teaching cards, drills them, repeats whatever was missed, and ends on a results screen (PR-3, PR-4).

1. **Intro.** Lesson title, type and the items it will teach.
2. **Teaching cards.** One card per new item: the item, reading, meaning, audio, one example. Grammar lessons show the explanation summary. No answer required.
3. **Exercises.** 10 to 15, one per screen, with a progress bar. Check button, then a feedback bar. Correct: green with a short confirmation. Wrong the first time: an amber "not quite, try once more" bar that does not reveal the answer, and the learner answers again straight away. Wrong the second time: red with the correct answer and a one-line reason, and the exercise is marked incorrect. An answer fixed on the second try counts as correct. Match pairs and drawing exercises already allow retries and are unchanged.
4. **Retry round.** Missed exercises return at the end until answered correctly.
5. **Results.** XP earned, accuracy, new items added to reviews, streak update, and any achievement unlocked.

Leaving mid-lesson saves progress for 24 hours. A "my answer should be accepted" button on the feedback bar files a report for the author.

**Exercise catalog**

| ID | Exercise | The learner | Answer check |
| --- | --- | --- | --- |
| EX-01 | Multiple choice | Picks the meaning, reading or item from 4 options | Exact |
| EX-02 | Match pairs | Pairs 5 items with meanings or readings | Exact |
| EX-03 | Word bank | Builds a translation by tapping word tiles in order | Any accepted tile order |
| EX-04 | Typed answer | Types a meaning in English or a reading in kana | Accept list, normalized |
| EX-05 | Fill the blank | Chooses or types the missing particle or word in a sentence | Accept list |
| EX-06 | Reorder | Drags sentence chunks into the right order | Any accepted order |
| EX-07 | Listen and choose | Hears audio, picks what was said or what it means | Exact |
| EX-08 | Dictation | Hears audio, types it in kana | Normalized kana match |
| EX-09 | Reading in context | Picks the right reading of a kanji inside a given word | Exact |
| EX-10 | Conjugate | Types a requested form (for example te-form of a verb) | Normalized kana or kanji match |
| EX-11 | Stroke trace | Traces each stroke over a guide in order | Stroke order and direction |
| EX-12 | Draw from memory | Draws the character with no guide, given meaning or reading | Stroke count, order and rough shape; hint after 2 misses |

**Answer checking rules** (*language-specific*)

- English answers ignore case, punctuation, extra spaces and leading "to" or articles; one-letter typos are accepted with a "watch your spelling" note.
- Japanese answers treat hiragana and katakana input as written, convert typed romaji to kana, and accept the kanji or kana spelling of the same word unless the exercise is testing the kanji.
- Every typed exercise carries an accept list that authors can extend from learner reports.
- Distractors in choice exercises come from items of the same type and level, preferring look-alike kana and kanji.

## 5. Kanji experience

Kanji get their own lessons, their own reference pages and two review facets each, meaning and reading (PR-10 to PR-15). *Language-specific: enabled for languages whose plugin declares a logographic script.*

**Kanji detail page**

| Block | Content |
| --- | --- |
| Header | The kanji large, primary meaning, JLPT level, stroke count, the learner's review stage |
| Stroke order | Animation with play, step and replay; a "practice drawing" button |
| Meanings | All English meanings, primary first |
| Readings | On readings and kun readings (with okurigana marked); the reading taught first is highlighted |
| Components | Radical and component parts, each linking to kanji that share it |
| Words | Course words using this kanji, with reading, meaning, audio and the learner's stage; taught words first |
| Sentences | Up to 5 example sentences containing those words |
| My note | Free-text mnemonic or note, private to the learner |

**Kanji lesson flow**

1. Teaching card: kanji, meaning, stroke animation.
2. Stroke trace (EX-11).
3. Meaning exercises (EX-01, EX-04).
4. Teaching card: main reading and 1 to 3 words that use it.
5. Reading exercises (EX-09, EX-04) and word exercises (EX-01, EX-02).
6. Draw from memory (EX-12) for each kanji before the lesson ends.

**Drawing canvas**

- Square canvas with a faint grid; works with finger, stylus or mouse.
- Trace mode shows the next stroke as a guide; a stroke that starts at the wrong end or in the wrong order shakes and is discarded.
- Memory mode shows no guide; after 2 failed attempts at a stroke the guide flashes once.
- Tolerance is forgiving: stroke order, direction and approximate position count, neatness does not.
- Learners who cannot or prefer not to draw can turn drawing exercises off in settings; they are replaced by recognition exercises.

**Kanji library**

A grid of every kanji in the course, colored by the learner's stage. Filters: level, stroke count, radical, stage (not started, learning, strong, mastered). Search by kanji, meaning or reading. The same stroke animation, trace and draw features apply to kana.

## 6. Grammar experience

Every grammar point is a hand-authored item with a reference page, a dedicated lesson and its own reviews (PR-20 to PR-23).

**Grammar point page**

| Block | Content |
| --- | --- |
| Header | The pattern (for example "Verb-te + kudasai"), a one-line meaning, level, the learner's stage |
| Formation | How to build it, as a small table of word type and form, with a worked example for each row |
| Explanation | 2 to 5 short paragraphs on meaning, nuance, politeness and common mistakes |
| Examples | 4 to 8 sentences with audio, furigana and English; the pattern is highlighted in each |
| Related | Links to similar or contrasting points ("compare with...") |

Tapping any word in an example opens a small card with its reading and meaning, and a link to its page if the word is in the course.

**Grammar lesson flow**

1. Teaching cards: the pattern and meaning, then the formation table, then two examples.
2. Recognition: choose the sentence that uses the pattern correctly (EX-01).
3. Formation: fill the blank and conjugate (EX-05, EX-10).
4. Production: reorder and word bank translation (EX-06, EX-03).
5. One listening exercise using the pattern (EX-07).

**Grammar reference**

A list of all grammar points grouped by level and by theme (particles, verb forms, adjectives, connecting sentences, and so on), searchable by pattern or English meaning. Points not yet reached are readable but marked "not yet learned". A "practice this" button starts a 10-exercise drill on any learned point.

## 7. Reviews

Every item taught in a lesson enters a fixed-interval spaced-repetition ladder; answering correctly moves it up a stage, answering wrongly moves it down (PR-40 to PR-43).

| Stage | Name shown | Next review after a correct answer |
| --- | --- | --- |
| 1 | Learning | 4 hours |
| 2 | Learning | 1 day |
| 3 | Learning | 3 days |
| 4 | Familiar | 1 week |
| 5 | Familiar | 2 weeks |
| 6 | Strong | 1 month |
| 7 | Mastered | 4 months |
| 8 | Retired | Never; no longer reviewed |

**Rules**

- A wrong answer drops the item 1 stage from stages 1 to 4, and 2 stages from stage 5 and above; it is then due again after that stage's interval.
- Review facets: a kanji is reviewed on meaning and on reading; a word on meaning, reading and (if it has audio) listening; a grammar point through a fill-the-blank or reorder exercise drawn from its pool. An item moves up only when all its facets are answered correctly in the session.
- Kana enter the ladder too, but skip straight to stage 4 after the kana lesson's own drills.
- The Review tab shows the number due now, a start button, and a 7-day forecast of items coming due per day.
- A review session serves up to 20 items at a time, oldest due first, mixing item types; the learner can stop at any point and keep credit for what was answered. Reviews give the same one immediate second try as lessons, to forgive slips and mis-taps; an item drops a stage only if the second try is also wrong.
- Settings: daily cap on new lesson items (default 20) and on reviews (default 100). When reviews due exceed 150, the path suggests reviewing before starting new lessons, but does not block.
- A learner can manually send any item back to stage 1 or retire it from its detail page.
- The item's stage appears as a colored ring on its tile everywhere in the app.

The intervals are a starting point and are stored as configuration, so they can be tuned without changing the experience described here.

## 8. Audio and text display

Every word and sentence has a speaker button, and Japanese text follows the learner's furigana setting everywhere (PR-6, PR-7, PR-50 to PR-53).

**Audio**

- Speaker button on teaching cards, feedback bars, detail pages and example sentences; a second button plays at 0.75 speed.
- Audio auto-plays when a new item is shown and when an answer is revealed; auto-play can be turned off.
- Listening exercises hide the text until the answer is checked. A "can't listen now" button skips listening exercises for 15 minutes with no penalty.
- Clips are generated on the server by a free text-to-speech voice the first time they are played (a wait of under a second) and kept for every later play, so nobody records anything. If the server cannot produce a clip, the app speaks with the Japanese voice built into the learner's device; if the device has none, speaker buttons are hidden and listening exercises are skipped. An author can still replace any clip with an uploaded recording.

**Japanese text display** (*language-specific*)

| Setting | Behavior |
| --- | --- |
| Furigana: always | Readings shown above every kanji |
| Furigana: unlearned only (default) | Readings shown only above kanji the learner has not yet reached stage 4 |
| Furigana: never | No readings; tap a word to reveal |
| Romaji | Shown only inside the Kana section; off everywhere after it |
| Text size | Normal or large Japanese text |

**Typing Japanese** (*language-specific*)

- Kana answer fields convert romaji to hiragana as the learner types ("ka" becomes か); holding shift or typing in capitals gives katakana.
- A device IME works too; the field accepts kana directly.
- On phones, exercises that need typing offer a "use word bank instead" toggle, which the learner can make the default.

## 9. Gamification and social

XP is the single currency: it feeds the daily goal, the level, the weekly leaderboard and friend comparisons (PR-60 to PR-66). There are no hearts, lives or purchases.

**XP**

| Action | XP |
| --- | --- |
| Complete a new lesson | 10 |
| Accuracy bonus (90% or better before the retry round) | +5 |
| Replay a completed lesson | 5 |
| Each review item answered correctly | 1 |
| Complete a unit review | 20 |
| Pass a unit test-out | 30 |
| Reference-page practice drill | 5 |

**XP boosters** (PR-67)

A booster multiplies every XP award for a short time and starts the moment it is earned, with a countdown shown on the Learn tab and in the lesson player.

| Booster | Lasts | Earned by |
| --- | --- | --- |
| 1.5x | 10 minutes | Finishing a lesson with no exercise marked incorrect |
| 2x | 15 minutes | Reaching the daily goal; clearing every review due that day |
| 3x | 15 minutes | Completing a unit; each 7th day of a streak |

- Only one booster is active at a time. A higher multiplier earned while one is running replaces it; an equal or lower one adds 5 minutes to the running booster.
- Boosted XP counts everywhere: daily goal, level, leaderboard and achievements.
- The timer runs in real time and does not pause when the app is closed.
- These triggers and durations are starting values, stored as configuration.

**Daily goal, levels and streaks**

- Daily goal: the learner picks 10, 20, 30 or 50 XP; a ring on the Learn tab fills as XP is earned.
- Level: kept separately for each course and rises with the XP earned in that course; each level needs 100 XP more than the last (level 2 at 100, level 3 at 300, level 4 at 600).
- Streak: counts consecutive days on which the learner earned at least 10 XP, using the learner's own time zone.
- Streak freeze: protects one missed day automatically. A learner holds at most 2 and earns one for every 7-day run.
- Milestone streaks (7, 30, 100, 365 days) get a full-screen celebration.

**Leaderboard**

- One board for everyone on the server, ranked by XP earned this week.
- The week runs Monday 00:00 to Sunday 23:59 in the server's time zone; the top three of the finished week get a badge on their profile.
- Learners can opt out; they then see the board but do not appear on it.

**Friends**

- A learner can follow anyone on the server; following is one-way and needs no approval, since everyone is invited.
- The Friends list shows each person's streak, level, weekly XP and course section.
- A learner can send a one-tap "nice work" or "keep going" nudge, shown as an in-app notification, at most once per friend per day.
- Any learner can turn off nudges and leaderboard visibility in settings.

**Achievements**

| Group | Examples |
| --- | --- |
| Streak | 7, 30, 100, 365 days |
| Kanji | 10, 50, 100, 300, 650 kanji at Familiar or above |
| Vocabulary | 100, 500, 1,000, 3,000 words at Familiar or above |
| Grammar | 10, 50, 100 grammar points learned |
| Course | Kana complete; each section complete |
| Effort | First perfect lesson; 100 reviews in a day; 1,000 XP in a week |
| Drawing | 100 characters drawn from memory |

## 10. Themes and visual direction

The app is bright, rounded and playful, and gets its personality from color, shape and motion instead of mascot characters (PR-65).

- **Shape language.** Chunky rounded buttons with a pressed-down state, pill-shaped progress bars, circular lesson nodes on a winding path, large friendly type.
- **Color as meaning.** Each lesson type keeps its color in every theme (vocabulary blue, kanji purple, grammar green, listening orange, review gold). Correct is green, wrong is red, and both always carry an icon as well.
- **Celebration without characters.** Confetti, a growing streak flame icon, XP counters that tick up, progress rings that close, and short sound effects. All motion and sound can be reduced or turned off.
- **Themes.** The learner picks one in settings; each has a light and a dark variant.

| Theme | Feel | Accent |
| --- | --- | --- |
| Sakura (default) | Soft and warm | Pink |
| Matcha | Calm | Green |
| Umi | Cool and clear | Ocean blue |
| Yuyake | Energetic | Sunset orange |
| Sumi | High contrast, minimal | Ink black and white |

- **Accessibility.** Text contrast meets WCAG AA in every theme; nothing depends on color alone; every action is reachable by keyboard; tap targets are at least 44 px.

## 11. Accounts, settings and administration

People join only through an invite, and everything an admin needs, including content authoring, is inside the app (PR-70 to PR-76).

**Joining and signing in**

1. An admin creates an invite: email address, account type (learner or admin), expiry (default 7 days), single use. The app emails the link and also shows it to copy.
2. The invitee opens the link, chooses a username, display name and password, and picks a daily goal.
3. The Learn tab opens on the first lesson.

Sign-in is by username or email and password, and a device stays signed in for 30 days. Password reset is by emailed link; in case email is unavailable, an admin can set a temporary password, and the learner must choose a new password when they sign in with it.

**Learner settings**

| Group | Settings |
| --- | --- |
| Profile | Display name, avatar color and initial, time zone, password |
| Study | Daily goal, new-item cap, review cap, drawing exercises on or off, prefer word bank on phones |
| Display | Theme, light or dark, furigana mode, Japanese text size |
| Sound and motion | Sound effects, audio auto-play, reduced motion |
| Social | Appear on leaderboard, allow nudges |
| Data | Export my progress, delete my account |

**Roles**

| Account type | Can |
| --- | --- |
| Learner | Study, manage own settings and data |
| Admin | Everything a learner can, plus create and edit course content, resolve answer reports, and manage users, invites, imports, backups and server settings |

There is no separate author role. Where this spec says "author", it means an admin doing content work.

**Admin console**

- Users: list with role, last active, streak; change role, disable, reset password.
- Invites: create, list, revoke.
- Activity: active learners per day, lessons and reviews completed, open answer reports.
- Imports: run or re-run a dataset import and see its result.
- System: app version, storage used, last backup time, "back up now".

**Content editor**

- A course tree (sections, units, lessons) with drag to reorder.
- Item editors for words, kanji and grammar points; imported fields are pre-filled and can be overridden without being lost on re-import.
- Grammar point editor with the blocks from section 6 and a sentence editor that splits and joins tiles, marks furigana and highlights the pattern. Imported sentences arrive with tiles already filled in and marked unreviewed; an author's tiles are never overwritten. Each sentence shows its grammar level and whether it is a challenge sentence, and the author can override that.
- Word lists: a supplementary list of common words per level that the level lists lack, and a word blocklist per language (empty at start) that keeps imported sentences containing those words out and flags them in authored content.
- Lesson editor: choose the lesson's new items, then either let the app generate exercises from item data (vocabulary, kanji, kana, listening) or hand-write exercises (grammar). Generated exercises can be pinned, edited or removed.
- Preview plays the lesson exactly as a learner would see it.
- Draft and published states at lesson and unit level; publishing a change never resets learner progress.
- Answer reports inbox: accept (adds to the accept list) or dismiss.

## 12. Adding a language

A new language is a content pack plus a small language plugin; the learner experience above stays the same apart from the parts marked language-specific (PR-80 to PR-82).

| Part | What it provides | Japanese | A language like Spanish |
| --- | --- | --- | --- |
| Content pack | Course tree, items, sentences, grammar points, audio | Kana, N5 to N3 | Its own units and items |
| Scripts | Which writing systems exist and how to show readings | Hiragana, katakana, kanji, furigana | Latin only, no readings |
| Character study | Whether character pages, stroke animation and drawing are on | On | Off |
| Input help | How typed answers are assisted | Romaji-to-kana | Accent-key helper |
| Answer checking | How answers are normalized and compared | Kana and kanji equivalence | Accent and case tolerance |
| Word breaking | How a sentence splits into tappable words and tiles | Tiles stored with each sentence and authored exercise answer: seeded at import or on save by a morphological analyzer, corrected by authors | Spaces |
| Item fields | Extra facts an item carries | On and kun readings, pitch (later) | Gender, plural |
| Voice | Which text-to-speech voice to use | Japanese voice | Spanish voice |
| Levels | The level framework for sections | JLPT N5 to N3 | CEFR A1 to B1 |

A learner can enroll in more than one course and switches between them from the Learn tab. The streak and daily goal are shared across courses. XP totals, level, reviews and progress are per course, so a learner can be level 40 in Japanese and level 75 in Spanish. The weekly leaderboard counts XP from all courses.

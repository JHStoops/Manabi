# 3. Software Design Document — Manabi

Source: https://claude.ai/artifact/1YC78Sq4BHtxvQGXjHWbnS, exported 2026-11-11

## 1. Design summary

Manabi is a TypeScript monorepo: a React single-page app talking to a Node API over versioned REST, with PostgreSQL as the only stateful service, deployed with Docker Compose on the home server. Language-specific behavior lives in plugin packages shared by client and server.

| Area | Decision | Why |
| --- | --- | --- |
| Language | TypeScript on both sides | One language, shared types and shared answer-checking code |
| Repo | npm workspaces monorepo | Shared packages without publishing; one install, one CI |
| Frontend | React with Vite and React Router; state with React's own useReducer and useContext | Required stack; fast builds; no state library to add or maintain |
| Styling | Emotion (CSS-in-JS) with its ThemeProvider | Works naturally with React; style objects are shared between components; a theme is one object swapped at the provider |
| Backend | Node (current LTS) with Fastify | Required stack; schema-first routes, good performance on small hardware |
| Validation | Zod schemas in a shared package | Same schema validates requests, types the client and generates OpenAPI |
| Database | PostgreSQL with hand-written SQL through the pg driver (no ORM) and plain SQL migration files | Relational core plus JSONB for per-language item fields and exercise payloads |
| Background jobs | pg-boss (queue stored in PostgreSQL) | Imports and weekly rollover without adding Redis |
| Auth | Opaque session tokens stored in the database; cookie for web, bearer header for mobile | Revocable, simple, works for both client kinds |
| Audio | Clips generated on first play by Kokoro (self-hosted, voice `jf_alpha`, sent the kana reading) behind a provider interface and cached on disk, with the browser's built-in speech voice (Web Speech API) as fallback when no clip can be produced | No cloud cost; no bulk generation to run; engine can be swapped per language |
| Stroke data | KanjiVG converted at import to Hanzi Writer data, animated and checked in the browser by Hanzi Writer (MIT) | Open data; proven matcher with animation and hints built in; no server round-trip while drawing |
| Sentence tiles | Segmented in Node at import and when an author saves (a generic kuromoji adapter in `packages/importers`, the merge rules in the language plugin) and stored with each sentence and with authored exercise answer text, with base form and reading per tile | The analyzer is too large for the browser; language rules stay in the plugin; tiles never change after review |
| Mobile readiness | Everything through `/api/v1`, documented by OpenAPI; installable PWA now | A native or React Native client can reuse the API and shared packages |
| Deployment | Docker Compose in one Proxmox LXC, behind the existing Nginx Proxy Manager | One command up; fits the existing server |

Principles: the server is the source of truth for progress; courses are data; anything that differs by language sits behind the plugin interface; prefer one boring dependency over two clever ones.

## 2. Architecture

> Diagram: architecture · 2 clients, proxy, 5 services. See the live document.

The API server is the only component clients talk to. It and the worker share one codebase and one database; the worker handles imports and anything scheduled. The API calls the TTS engine when a clip is first requested.

## 3. Repository layout

Apps depend on packages; packages never depend on apps; language plugins depend only on `core`.

| Path | Contents |
| --- | --- |
| `apps/web` | React app: routes, screens, exercise components (including the Hanzi Writer stroke component), themes, PWA manifest |
| `apps/api` | Fastify server: routes, services, database access, job handlers; also serves the built web app |
| `packages/core` | Domain types, Zod schemas, exercise type definitions, SRS scheduler, XP and streak rules, the `LanguagePlugin` interface |
| `packages/lang-ja` | Japanese plugin: kana and kanji handling, romaji conversion, answer normalization, exercise generators, item field schemas, the segmentation merge rules and grammar detection matcher over analyzer tokens (pure functions) |
| `packages/api-client` | Typed client generated from the OpenAPI document; used by web and, later, mobile |
| `packages/importers` | Dataset parsers and import jobs (KANJIDIC2, JMdict, KanjiVG, Tatoeba, level lists); the committed copy of the level lists; a generic, Node-only analyzer adapter registry (kuromoji with its IPADIC dictionary loading) with no language rules, and the segmentation path that runs a plugin's declared analyzer and then the plugin's own rules |
| `content/ja-en` | The Japanese course content pack: YAML and Markdown under version control |
| `deploy` | Dockerfile, Compose file, example environment file, database dump script, Nginx Proxy Manager setup notes |
| `docs` | These four documents, exported |

Inside `apps/api`, code is organized by feature module (auth, courses, lessons, reviews, social, admin, content), each with its routes, service and queries. `apps/web` mirrors the same feature names.

## 4. Language plugins and content packs

Adding a language means writing one plugin package and one content pack; core, API and web code do not change (PR-80, PR-81).

**The** `LanguagePlugin` **interface** (in `packages/core`, implemented by `packages/lang-ja`)

| Member | Purpose |
| --- | --- |
| `code`, `name` | Identifier (`ja`) and display name |
| `scripts` | Writing systems and whether each has readings shown above text |
| `features` | Flags: `characterStudy`, `strokeDrawing`, `readingAnnotations`, `inputConversion` |
| `itemSchemas` | Zod schema per item type for the language-specific `data` fields (for example on and kun readings) |
| `normalizeAnswer(text, context)` | Canonical form for comparison (kana folding, width, case, punctuation) |
| `checkAnswer(given, accept, testsKanji)` | Checks a typed answer against an exercise's accept list (only what checking needs, never the whole exercise); returns correct, near-miss with a hint, or wrong |
| `convertInput(text, mode)` | Live input help (romaji to kana) |
| `tokenize({ text, tiles })` | Returns a sentence's or answer's tappable words and word-bank tiles: the tiles stored with it, unchanged; only as a last resort, when none are stored, a simple fallback (one tile per run of the same script, or spaces for languages that use them) whose base form and reading are just the surface, so it is never used for audio or furigana |
| `analyzer` | Which Node-only morphological analyzer the plugin's segmentation needs, by adapter id (Japanese: `'kuromoji-ipadic'`), or null for languages split on spaces: the importers' generic whitespace adapter then supplies the tokens (part-of-speech tags empty, base form and reading null) |
| `segment(tokens)` | Pure function from analyzer tokens (surface, part-of-speech tags, base form, reading) to tiles with surface, base form and reading (Japanese: merge rules R0 to R10 and the idiom split list), each a `SegmentedTile` whose `counted` flag says whether it counts toward the vocabulary level in the coverage check (particles, auxiliaries, numbers, counters and names do not); only the tile itself is stored |
| `detectGrammar(tokens, points)` | Pure matcher: which of the given grammar points' detection patterns match the analyzer tokens |
| `annotate(tiles, learnedItems)` | Produces reading annotations from a sentence's stored tiles, honoring the learner's furigana setting |
| `generators` | Functions that build exercises of each type from an item and its course context |
| `reviewFacets(itemType)` | Which facets an item is reviewed on (meaning, reading, listening) |
| `ttsVoice` | Provider, voice id, any provider language option, the locale for the device-voice fallback, and which text to send (reading or written form) (Japanese: Kokoro, `jf_alpha`, `lang_code` `j`, `ja-JP`, always the kana reading) |
| `readingOf(tiles)` | The reading sent to the TTS engine for a sentence or answer, built from its tiles (Japanese: the tile readings joined) |

Plugins are pure TypeScript with no Node or browser APIs, so the same code runs in the browser for instant feedback and on the server for the authoritative check. They are registered in one map keyed by language code (`createLanguagePluginRegistry`, built by each app from the plugins it ships; an unknown code throws `UnknownLanguagePluginError`, a duplicate `DuplicateLanguagePluginError`); a course row names its plugin.

**Segmentation and grammar detection.** All Japanese-specific rules live in `packages/lang-ja`; only the analyzer itself, which needs a large dictionary and Node APIs, lives outside it. The plugin declares the analyzer it needs (`analyzer`) and supplies pure functions over that analyzer's tokens: `segment` (the merge rules from the word-boundary spike) and `detectGrammar` (each grammar point's detection patterns). `packages/importers` holds a generic analyzer adapter registry keyed by adapter id (`kuromoji-ipadic`: kuromoji 0.1.2 and its dictionary loading) with no language rules, and one segmentation path: look up the course's plugin, run its declared analyzer on the text, then call the plugin's `segment` and, for sentences, `detectGrammar`. The path runs only in Node: in the import job, and in the API when an author saves text in an editor. Its output is stored, so the browser only reads it. No analyzer ships to the browser.

**Tiles for authored exercise text.** Answer text in authored exercises (EX-04, EX-05, EX-08 and EX-10 answers and accept lists, hand-authored word-bank exercises, and the tile form used by the word-bank alternative on phones) gets tiles from the same segmentation path when a pack is imported or an author saves the exercise in the editor. The tiles are stored in the exercise payload in the same shape as sentence tiles (DR-12). Authors can edit them and re-segment on request; tiles an author has edited are never overwritten on re-import. `tokenize`'s script-run fallback is a last resort for text that somehow has no stored tiles, not the normal path.

Stroke data is supplied per language at import (Japanese: KanjiVG) and stored in Hanzi Writer's character format; the stroke component in `apps/web` is language-neutral and draws whatever data the course provides.

The web app renders script features from the `features` flags: the Kanji area of the Library, stroke exercises and furigana settings appear only when the active course's plugin enables them. A Chinese plugin could switch `characterStudy` on and reuse the same components with different stroke data.

**Content pack format** (`content/<target>-<base>/`)

| File | Holds |
| --- | --- |
| `course.yaml` | Course id, languages, plugin, sections and their order |
| `units/<nn>-<slug>.yaml` | Unit title, lessons, each lesson's type and item keys, hand-written exercises |
| `items/words.yaml`, `items/kanji.yaml` | Overrides and additions on top of imported data, keyed by stable item key |
| `grammar/<key>.md` | One grammar point: front matter (pattern, level, related, detection patterns over segmenter tokens) and Markdown body with marked-up examples. A point may be a stub (pattern, level and detection patterns only) until its page is written, so higher-level points can be detected before they are taught |
| `sentences.yaml` | Curated and reviewed sentences with tiles (surface, base form, reading, item key), translation, review status, any challenge override and, for imported sentences, attribution |
| `lists/supplementary-words.yaml` | Common words per level that the level lists lack; treated as level-list words |
| `lists/blocked-words.yaml` | The word blocklist for the course's target language; empty at start |
| `audio/` | Optional recorded clips that replace generated ones |
| AUTHORING.md | The content authoring guide for Claude or a person adding a level: where each dataset comes from and its licence, the pack file formats with a worked example of each lesson type, naming and key conventions, style rules for grammar explanations and exercises, the step-by-step procedure for a new level (set the level ceiling, run imports, draft units, validate, preview, publish), and the lint command that must pass |

Tiles in pack files (in sentences.yaml and in authored exercise answer text) name their item by stable key; import resolves each key to the item's id for storage, a key with no item in the course is an import error, and export writes the key back (DR-02, DR-03).

The database is what the running app reads. A CLI and an admin action import a pack into the database and export the database back to a pack, so content edited in the admin editor can be committed to git and a course can be moved between servers. Items have stable keys (`ja:kanji:水`, `ja:word:水:みず`, `ja:grammar:te-kudasai`) so re-imports update in place and learner progress stays attached. Importing an updated or larger pack (for example adding N4) only adds and updates content rows: an import never writes to progress tables, lessons and items dropped from a pack are archived instead of deleted, and lessons added inside an already completed unit do not re-lock anything.

## 5. Data model

One PostgreSQL database holds content, accounts and progress. There is no ORM: each feature module has a queries file of hand-written, parameterized SQL run through the pg driver, with a small TypeScript type for each result row. Schema changes are numbered SQL files applied in order by a small migration runner (node-pg-migrate). Content tables are language-neutral; language-specific fields live in a JSONB `data` column validated by the plugin's schema.

**Content**

| Table | Key columns | Notes |
| --- | --- | --- |
| `courses` | id, target_lang, base_lang, plugin, title, status | One row per course |
| `sections` | id, course_id, position, title, level_code, archived_at | Kana, N5, N4, N3; archived instead of deleted when dropped from a pack |
| `units` | id, section_id, position, title, status | Draft or published |
| `lessons` | id, unit_id, position, type, title, status | Type is one of kana, vocabulary, kanji, grammar, listening, unit_review (the Product Spec's lesson types) |
| `items` | id, course_id, key (unique), type, level_code, data (JSONB), overrides (JSONB), source, dataset_version | Kana, kanji, word, grammar point; `overrides` survive re-import |
| `item_links` | from_item_id, to_item_id, kind | Word contains kanji; grammar related to grammar; kanji has component |
| `lesson_items` | lesson_id, item_id, position | The new items a lesson teaches |
| `sentences` | id, course_id, text, tokens (JSONB), translation, source, source_id, attribution (JSONB), review_status, grammar (JSONB), vocab_level_code, grammar_level_code, challenge_override, edited, translation_edited, tokens_edited | Tokens carry tiles with surface, base form, reading and item id; the sentence reading is the tiles' readings joined. Attribution holds owner, URL, licence and dataset version for the sentence and its translation separately. Review status is unreviewed, flagged or reviewed; grammar lists the points detected at import; `vocab_level_code` is the highest level among the content words, set by the import's coverage check and recomputed when tiles change; `grammar_level_code` (same domain as `level_code`) is the highest level among them, null when none; `challenge_override` is null when the challenge status is derived (`grammar_level_code` above `vocab_level_code`) and true or false when an author has set it; edited, translation_edited and tokens_edited mark author changes to the imported text, translation and tiles, which re-import never overwrites |
| `supplementary_words` | id, course_id, level_code, written, reading, note | Admin-editable; seeded from the words that block the most imported sentences |
| `level_list_words` | course_id, level_code, written, reading | Words of the JLPT level lists up to the level ceiling, written by the level-list import; the vocabulary import filters on them with the supplementary words |
| `blocked_words` | id, lang, word | Admin-editable blocklist per language; empty at start |
| `sentence_items` | sentence_id, item_id | For "example sentences using this item" |
| `exercises` | id, lesson_id (nullable), item_id (nullable), type, payload (JSONB), origin | Origin: authored, generated or pinned; item-level exercises feed reviews and drills |
| `audio_assets` | id, owner_type, owner_id, voice, path, origin, text_hash | Generated on first request or uploaded; hash of the reading sent detects stale audio; voice is null only for uploaded clips |
| `stroke_data` | item_id, strokes (JSONB) | Hanzi Writer character data converted from KanjiVG: an outline and a median per stroke |

**Accounts**

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | id, username, email, password_hash, display_name, role (admin or learner), must_change_password, password_expires_at, time_zone, settings (JSONB), disabled_at | Settings hold avatar color and initial, daily goal, caps, theme and color mode, furigana mode, text size, sound, motion and social toggles, and the active course (set by enrolling, FR-023); missing keys read as their defaults (learnerSettingsSchema in core); password_expires_at is set with an admin's temporary password |
| `invites` | id, token_hash, email, role, created_by, expires_at, used_by, used_at, revoked_at | Single use; email is null when the link was only copied |
| `sessions` | id, user_id, token_hash, client_kind, expires_at, last_seen_at | Web or mobile |
| `password_resets` | id, user_id, token_hash, origin, expires_at, used_at | Origin: email or admin issued |

**Progress**

| Table | Key columns | Notes |
| --- | --- | --- |
| `enrollments` | user_id, course_id, started_at, total_xp, level | A learner may enroll in several courses; XP total and level are kept per course here |
| `lesson_progress` | user_id, lesson_id, completed_at, best_accuracy, times_completed | Drives path unlocking |
| `unit_completions` | user_id, unit_id, completed_at | Insert-only; written when a unit's last visible lesson is completed or its test-out is passed. Unlocks the next unit for good, so lessons added to the unit later never re-lock it (FR-232) |
| `lesson_sessions` | id, user_id, lesson_id, unit_id, state (JSONB), expires_at | Resume within 24 hours; a unit challenge session has unit_id set and no lesson_id |
| `item_progress` | user_id, item_id, facet, stage, due_at, last_reviewed_at, correct_count, wrong_count | One row per review facet; index on (user_id, due_at) |
| `review_log` | id, user_id, item_id, facet, exercise_type, correct, stage_before, stage_after, answered_at | Append-only; feeds stats and future scheduler tuning |
| `xp_events` | id, user_id, course_id, base_amount, multiplier, amount, reason, ref_id, earned_at, local_date | Append-only ledger; source of truth for XP |
| `user_stats` | user_id, current_streak, longest_streak, freezes, last_active_date | Derived cache, rebuildable from the ledger |
| `user_notes` | user_id, item_id, body | Personal mnemonics |
| boosters | id, user_id, multiplier, reason, started_at, ends_at | XP boosters; at most one active per learner |

**Social and admin**

| Table | Key columns | Notes |
| --- | --- | --- |
| `follows` | follower_id, followee_id, created_at | One-way |
| `nudges` | id, from_user_id, to_user_id, kind, sent_at, local_date, seen_at | One per pair per day (the sender's local date) |
| `weekly_results` | week_start, user_id, xp, rank | Written at rollover; the live board is a query over `xp_events` |
| `achievements` | key, group_key, metric, threshold, title | Seeded definitions (`group` is a reserved word in SQL) |
| `user_achievements` | user_id, achievement_key, earned_at, seen_at | seen_at marks the celebration as shown |
| `answer_reports` | id, user_id, exercise_id (nullable), item_id (nullable), exercise_type, exercise_payload (JSONB), given_answer, status, resolved_by, resolved_at | Author inbox; keeps a copy of the exercise, since session-generated ones are not stored; points at the stored exercise and/or the item; user_id is nulled when the reporter's account is deleted |
| `import_runs` | id, importer, started_at, finished_at, status, summary (JSONB) |  |

All timestamps are stored in UTC. `local_date` on `xp_events` is the learner's calendar date at the time, computed from `users.time_zone`, so streaks do not shift if the learner later changes zone.

## 6. Exercise engine

Each exercise type is one registry entry with four parts, so adding a type touches one definition and one React component and nothing else.

| Part | Lives in | Role |
| --- | --- | --- |
| Payload schema | `packages/core` | Zod schema for the stored JSONB payload (prompt, options, accept list, stored tiles for answer text, audio ref, item refs) |
| Grader | `packages/core`, calling the language plugin | Takes payload and response, returns correct, near-miss or wrong, plus the feedback text |
| Generator (optional) | Language plugin | Builds a payload from an item and course context; used for vocabulary, kanji, kana and listening |
| Renderer | `apps/web` | React component registered under the type id; receives payload, reports a response |

**Building a lesson session**

1. The API loads the lesson's items and its stored exercises (authored and pinned). Sentences for generated exercises come only from those whose `vocab_level_code` and `grammar_level_code` are at or below the section's level and that are not marked challenging (FR-056).
2. If the lesson type allows generation, generators fill the session up to its target length, choosing types by a per-lesson-type recipe and drawing distractors from items the learner has already met.
3. The session (teaching cards, ordered exercises with payloads and accept lists) is saved in `lesson_sessions` and returned to the client in one response.
4. The client grades each answer locally with the shared grader for instant feedback and records the response. In lessons and reviews a first wrong answer allows one immediate second attempt; the response records both attempts, and the exercise counts as incorrect only if the second also fails.
5. On completion the client posts all responses; the server re-grades them with the same code, then in one transaction writes `lesson_progress`, creates `item_progress` rows for new items, appends `xp_events`, updates `user_stats` and evaluates achievements.

**Unit challenge** (FR-057, FR-058). A completed unit offers an optional challenge, modelled like the test-out: per unit, not a lesson row, so it never affects unlocking. Its pool is the unit's challenging sentences: every word taught by the end of the unit and at least one taught in it, with `vocab_level_code` at or below the section's level and `grammar_level_code` exactly one level above it, or `challenge_override` true; a sentence with `challenge_override` false is never in the pool. With fewer than 5 sentences the path does not show it. `POST /units/:id/challenge` builds (or resumes) a session of 10 to 15 exercises from the pool with the plugin's sentence generators (choice, word bank, fill the blank, reorder), stored in `lesson_sessions` with `unit_id` set, and completes through the same endpoint and transaction as a lesson. XP uses the lesson rules scaled by 1.5 (a challenge factor in the core rules table) with reason `unit_challenge` and the unit as `ref_id`: each award's `base_amount` is round(lesson amount × 1.5), so the first completion earns 15 plus an 8 accuracy bonus and later ones 8 replay XP, decided from the ledger; an active booster then applies through `multiplier` as for any award. Answers on learned items that are due are applied as review answers (stage change and `review_log` row); items not due are left alone, and the next-level grammar points get no review entries until their own grammar lessons.

Sending accept lists to the client trades cheat resistance for responsiveness and offline tolerance, which is the right trade for an invite-only family app; the server re-grade keeps recorded progress honest.

Review sessions use the same engine: for each due item and facet the API picks an item-level exercise (stored or generated) of a type suited to the facet. Stroke exercises are graded entirely in the browser by Hanzi Writer's stroke matcher, and the server records the reported result.

## 7. Progress logic

Scheduling, XP and streak rules are pure functions in `packages/core`, configured by data, and applied by the API inside database transactions.

**SRS scheduler.** A `Scheduler` interface takes an item's current state and a review outcome and returns the next stage and due time. v1 ships `FixedLadderScheduler`, driven by the interval table in the Product Spec, stored as server configuration. The append-only `review_log` keeps enough history to switch to an adaptive scheduler such as FSRS later without losing data. Due items are found with one indexed query on `item_progress (user_id, due_at)`.

**XP and levels.** Every award is a row in `xp_events` with a reason code; amounts come from a rules table in `core`. `enrollments.total_xp` and `level` are kept per course, updated in the same transaction, and can be rebuilt from the ledger by an admin command. The streak, daily goal and weekly leaderboard sum XP across all of a learner's courses. An active booster multiplies each award: the service reads the learner's active booster inside the same transaction and stores base amount, multiplier and final amount, so totals stay auditable. Boosters are granted after a progress transaction by the same data-driven rules step that awards achievements, with triggers and durations in configuration.

**Streaks.** On each XP award the service sums the learner's XP for `local_date`. When it first reaches 10, the streak advances: if `last_active_date` was yesterday, add 1; if the gap is covered by held freezes, the learner is asked (`pendingFreezeSpend` in `GET /me/stats`) and a yes spends them through `POST /me/streak/freezes`; a no, or earning XP before answering, restarts at 1 and keeps the freezes. A job never spends freezes: it resets the streak of learners whose missed days exceed the freezes held, so the number shown is correct even for someone who has not opened the app.

**Leaderboard.** The live board is an aggregate over `xp_events` for the current week, filtered to learners who opted in, cached in memory for 30 seconds. A scheduled job at week end writes `weekly_results` and awards top-three badges.

**Achievements.** Definitions are data: a metric name and a threshold. After any progress transaction, the service recomputes only the metrics that transaction could have changed and inserts newly earned rows; the response includes them so the client can celebrate.

**Notifications.** In-app only in v1: nudges, achievements and weekly results are read from their tables on app load. The design leaves a `notifications` channel abstraction so email or push can be added later.

## 8. API design

The web app uses only the public REST API under `/api/v1`, so a mobile client gets the same capabilities (PR-84).

**Conventions**

- JSON over HTTPS; request and response bodies validated by the shared Zod schemas.
- An OpenAPI document is generated from the routes and served at `/api/v1/openapi.json`; `packages/api-client` is generated from it.
- Auth by session token: `HttpOnly` cookie for browsers, `Authorization: Bearer` for other clients.
- Errors use one shape: `{ error: { code, message, details } }` with conventional HTTP status codes.
- Lists use cursor pagination. Timestamps are ISO 8601 in UTC.
- Writes that award progress accept an `Idempotency-Key` header, so a retried submit never double-counts.
- Breaking changes go to `/api/v2`; additive changes stay in v1.

**Resources**

| Area | Endpoints (prefix `/api/v1`) |
| --- | --- |
| Auth | `POST /auth/login`, `POST /auth/logout`, `POST /auth/accept-invite`, `POST /auth/change-password`, `POST /auth/password-reset`, `GET /me`, `PATCH /me`, `GET /me/sessions`, `DELETE /me/sessions/:id` |
| Courses | `GET /courses`, `POST /courses/:id/enroll`, `GET /courses/:id/path` (sections, units, lessons with the learner's state) |
| Lessons | `POST /lessons/:id/sessions` (start or resume), `POST /lesson-sessions/:id/complete`, `POST /units/:id/test-out`, `POST /units/:id/challenge` (start or resume a unit challenge) |
| Reviews | `GET /reviews/summary` (due now, forecast), `POST /reviews/sessions`, `POST /review-sessions/:id/answers` |
| Library | `GET /items` (filter by type, level, stage, search), `GET /items/:key`, `PUT /items/:key/note`, `POST /items/:key/drill`, `PATCH /items/:key/progress` |
| Media | `GET /media/audio/:ownerType/:ownerId` (the uploaded or cached clip; generated on the first request), `GET /media/strokes/:itemKey` |
| Social | `GET /leaderboard`, `GET /users/:id/profile`, `PUT /follows/:userId`, `DELETE /follows/:userId`, `GET /friends`, `POST /nudges` |
| Profile | `GET /me/stats`, `GET /me/achievements`, `GET /me/export`, `DELETE /me` |
| Reports | `POST /answer-reports` |
| Admin | `/admin/users`, `/admin/invites`, `/admin/imports`, `/admin/system`, `/admin/backups` |
| Authoring | `/authoring/courses`, `/authoring/units`, `/authoring/lessons`, `/authoring/items`, `/authoring/exercises`, `/authoring/sentences`, `/authoring/word-lists`, `/authoring/audio`, `/authoring/reports`, `/authoring/pack/import`, `/authoring/pack/export` |
| Health | `GET /healthz` (no auth) |

Role checks are enforced per route group: `/admin` needs admin, `/authoring` needs admin as well; there is no separate author role.

## 9. Frontend design

The web app is a client-rendered React SPA organized by feature, with all state held in React's built-in useReducer and useContext.

| Concern | Approach |
| --- | --- |
| Routing | React Router with lazy-loaded route chunks: learn, review, library, social, profile, admin, authoring. Admin and authoring code never loads for learners |
| Server state | A handful of context providers (session, course path, review summary, stats, social), each a reducer filled by the generated API client. After a progress write, the response carries the updated summary data and the affected providers dispatch it, so nothing is refetched needlessly |
| Local state | Component state and reducers. The lesson player is one reducer-driven state machine (teaching, answering, feedback, retry, results) shared by lessons, reviews and drills |
| Exercise renderers | A registry maps exercise type id to a lazily loaded component with one contract: `payload` and the course's language `plugin` in, `onAnswer(response)` out |
| Styling and theming | Emotion (CSS-in-JS). Each theme is one typed object (colors, lesson-type colors, spacing, radii, type scale) with a light and a dark variant, supplied through Emotion's ThemeProvider; components read it in their style functions and share style objects from a common styles module |
| Motion and sound | A small animation library for transitions and confetti; short audio sprites for effects; both gated by settings and `prefers-reduced-motion` |
| Japanese text | One `<AnnotatedText>` component renders the stored tiles with `<ruby>` furigana from their stored readings according to the setting; tapping a tile opens the word card, looked up by the tile's base form |
| Input | A kana input component wraps a text field and applies the plugin's `convertInput` (wanakana for Japanese) without fighting a device IME |
| Layout | Mobile-first; bottom tab bar under 768 px, side rail above; lesson player is full screen at all sizes |
| PWA | Web app manifest and a service worker that caches the app shell and recently played audio; installable to the home screen. No offline study in v1 |
| Interface text | All strings through an i18n library with English as the only catalog for now |
| Accessibility | Semantic HTML, focus management in the player, keyboard shortcuts (1 to 4 to choose, Enter to check), ARIA live region for feedback |

**Stroke canvas.** One component wraps Hanzi Writer (MIT, bundled with the app) and serves animation, trace and memory modes. Its character data comes from `stroke_data` through a custom data loader calling `GET /media/strokes/:itemKey`, never from Hanzi Writer's default CDN or its bundled Make Me a Hanzi data. Animation, outline, hints and checking are Hanzi Writer's own: its matcher compares each drawn stroke with the expected median on position, direction, shape (Fréchet distance) and length ratio, which also rejects squiggly strokes. Leniency is configuration, starting at Hanzi Writer's default of 1 and confirmed against the owner's recordings on issue #2. Trace mode shows the outline and the next stroke as a guide; memory mode hides the outline and shows the hint after 2 misses (`showHintAfterMisses: 2`). Hanzi Writer renders into the DOM, so it lives only in the web app's drawing exercise renderers; colours are passed from the Emotion theme. It listens to mouse and touch events, and stylus input arrives as touch.

**Path to mobile.** A future React Native or Capacitor app reuses `packages/core`, the language plugins and `packages/api-client` unchanged; only screens and the stroke canvas need native versions.

## 10. Content pipeline

Imports are repeatable background jobs that fill the `items`, `sentences` and `stroke_data` tables from open datasets; hand-authored content and overrides are never overwritten.

| Step | Source | Result |
| --- | --- | --- |
| 1. Kanji | KANJIDIC2 | One `items` row per kanji in scope, with meanings, readings, stroke count, radical |
| 2. Levels | JLPT Resources lists (tanos.co.uk, CC BY), from a parsed copy committed in `packages/importers` (the site no longer resolves), plus the per-level supplementary words | `level_code` set on kanji and words; levels above the configured ceiling (N3 for now) are skipped; raising it to N2 or N1 is a setting, not a code change |
| 3. Vocabulary | JMdict, filtered to the level lists and supplementary words | Word items with reading, meanings, part of speech; `item_links` to their kanji |
| 4. Strokes | KanjiVG | `stroke_data` for every kanji and kana, converted to Hanzi Writer data: a fixed-width ribbon outline around each KanjiVG centreline plus its median, in Hanzi Writer's 1024-unit y-up space |
| 5. Sentences | Tatoeba Japanese-English pairs, with Tatoeba's user languages export | Filtered, segmented into tiles, grammar level recorded and stored with attribution, flagged "unreviewed" (see the sentence rules below) |
| 6. Course pack | `content/ja-en` | Sections, units, lessons, grammar points, curated sentences, word lists, overrides |

**Import rules**

- Each importer is idempotent, keyed by the item's stable key, and records an `import_runs` row with counts of added, updated and skipped rows.
- Imported values go in `items.data`; author edits go in `items.overrides` and win when the item is read.
- Dataset files are downloaded by a script into a local folder, not committed; the dataset version and licence are recorded with each run and shown on the About page. The exception is the level lists: their source site is offline, so a parsed copy is committed with its credit and the importer makes no request for them.

**Sentence rules** (Tatoeba, from the sentence-quality spike)

- Keep a Japanese sentence only if it has a direct English translation (the lowest-id one is used; the others' ids are kept for the author), contains no Latin letters, is at most 15 characters excluding spaces and punctuation, and its owner declares native Japanese in Tatoeba's user languages export (this also drops ownerless sentences).
- Coverage: every content word, by base form, is at or below the sentence's level in the level lists or the supplementary words; particles, auxiliaries, numbers, counters and person and place names are exempt.
- Blocklist: a sentence containing a word on the language's blocklist is skipped. The same check reports blocked words in authored sentences and exercises in the pack lint and the editors.
- Segmentation: each kept sentence is split into tiles by the segmentation path in section 4 (the plugin's declared analyzer, then the plugin's `segment`), storing surface, base form and reading per tile. For Japanese the `kuromoji-ipadic` adapter (kuromoji 0.1.2) runs in `packages/importers` and the merge rules R0 to R10 and a small idiom split list run in `packages/lang-ja`; the spike's `rules.ts` (ported into the plugin) and `gold.tsv` are the starting code and test fixtures. Expect authors to adjust about 1 in 8 N5 sentences.
- Grammar level: grammar points are detected by the plugin's `detectGrammar` from each point's detection patterns over the analyzer's tokens, and the sentence's `grammar_level_code` is the highest level among them. No sentence is dropped or flagged for its grammar. A sentence whose `grammar_level_code` is above its `vocab_level_code` (set by the coverage check) is challenging: normal lessons skip it, the unit challenge of its vocabulary level uses it when its grammar is exactly one level up, and once the course reaches its grammar level it is an ordinary sentence there. Authors see the grammar level and challenge status in the sentence editor and can override the status (`challenge_override`). Only points present in the course are detected, so higher-level points can be added as stubs to make detection complete.
- Imported sentences start "unreviewed". Tiles an author has edited or reviewed, and authored sentences, are never overwritten on re-import.
- Each sentence and its translation store source id, owner (or none, shown as "Tatoeba contributors"), source URL, licence, dataset version and an edited flag; wherever an imported sentence is shown, a small credit links to its Tatoeba page.

**Audio generation.** A `TtsProvider` interface (`synthesize({ text, reading, voice, language, speed })` returning WAV bytes, where `language` is the plugin's `ttsVoice.providerLanguage`) hides the engine; the Kokoro adapter calls Kokoro-FastAPI's `POST /v1/audio/speech` over the internal network with `voice: jf_alpha`, `lang_code: j` and the kana reading as input, because Kokoro misreads kanji when sent the written form. A word's reading is its item reading; a sentence's reading is the plugin's `readingOf` its tiles (for Japanese, the tile readings joined). Clips are generated on request: when the client asks for the audio of a word or sentence, the API returns the uploaded or cached clip if its `text_hash` matches the current reading; otherwise it calls the provider (one generation per clip at a time; concurrent requests wait for it), trims leading and trailing silence, converts to mono Opus at about 24 kbps (roughly 3 kB per second of speech; an MP3 copy is made only if device testing shows a browser needs it), stores the file on the media volume, writes `audio_assets` and returns it. Kokoro took 0.2 to 0.4 s per clip at 4 vCPU, so the first play waits under a second and later plays are instant. There is no bulk pre-generation job. Uploaded recordings take priority over generated clips. In the web app, one speak() helper plays the server's clip; when the server cannot provide one (engine stopped or failing, or before audio generation exists in M1 and M2), it uses the browser's speechSynthesis with a voice matching the course language, passing the kana reading; if the device has no such voice, speaker buttons are hidden and listening exercises are skipped.

## 11. Authentication and security

The app is internet-facing but invite-only, so the design aims at keeping strangers out and limiting damage if one account is compromised (PR-86).

| Concern | Design |
| --- | --- |
| Passwords | Hashed with Argon2id; minimum 10 characters; checked against a small list of common passwords |
| Sessions | Random 256-bit token, stored hashed; 30-day sliding expiry; listed and revocable from the profile; all sessions revoked on password change |
| Cookies | `HttpOnly`, `Secure`, `SameSite=Lax`; state-changing requests also require a matching `Origin` header |
| Invites and resets | Single-use random tokens, stored hashed, with expiry. An admin-set temporary password sets must_change_password, so the next sign-in can do nothing but choose a new password; it expires after 7 days |
| Brute force | Rate limits per IP and per username on login, invite and reset routes; progressive delay after failures is deferred to the backlog (PRD section 7) |
| Authorization | Role checked per route group; every progress query is scoped by the session's user id in the service layer |
| Input | All bodies and queries validated by Zod; Markdown from authors is rendered through a sanitizer |
| Headers | Strict Content Security Policy, HSTS, no-sniff and frame-deny set by the API |
| Uploads | Audio only, size-capped, type-checked, stored outside the web root under generated names |
| Secrets | Supplied by environment file on the server, never committed |
| Network | Only the app's HTTP port is published, for Nginx Proxy Manager to reach; the database and TTS engine are on an internal Docker network |
| Privacy | Email used only for invites and password resets; no analytics or third-party requests from the client; export and delete endpoints for each learner |
| Updates | Dependency audit in CI; base images rebuilt monthly |

Public registration does not exist as a route; without a valid invite token there is no way to create an account.

**Dependency audit.** CI runs `npm audit` on every push, report only: it never fails the build. Findings are triaged by hand; each one that stays is listed below with its reason, exposure and a date to look again. State on 2026-11-21 (#119): `npm audit` reports 3 moderate, 0 high, 0 critical, all three in runtime dependencies (`npm audit --omit=dev` gives the same 3); dev-only tooling reports none.

| Finding | Reason it stays | Exposure | Review by |
| --- | --- | --- | --- |
| `glob` 13.0.x (GHSA-3g3m-2fjr-6pw4, AbortSignal bypass) and `minimatch` (GHSA-g3hv-75wg-m249, globparts DoS), both moderate, pulled in by `node-pg-migrate` 9.0.0, which pins `glob ~13.0.0`; `npm audit` also flags `node-pg-migrate` itself for them | No fixed `node-pg-migrate` release exists (9.0.0 is the latest; npm's suggested "fix" is a downgrade to 7.6.1). Forcing `glob` 14 with an override would run it under a major version `node-pg-migrate` is not tested with | Our migration runner (`apps/api/src/db/migrate.ts`) does not set `useGlob`, so `node-pg-migrate` lists the fixed migrations directory with `readdir` and never calls `glob`. Only the developer CLI (`npm run migrate:create`) would, and only for a directory pattern containing `*`. No user input reaches either | 2027-02-21, or as soon as a `node-pg-migrate` release moves to a fixed `glob` |

## 12. Deployment and operations

The whole app runs from one Compose file in a Proxmox LXC (nesting enabled so Docker can run), started with `docker compose up -d` (PR-85).

| Service | Image | Role |
| --- | --- | --- |
| `app` | Built from this repo | API server; serves the built web app; runs migrations on start |
| `worker` | Same image, different command | Background jobs and scheduled tasks |
| `db` | Official PostgreSQL | Data, on a named volume |
| `tts` | Kokoro-FastAPI CPU image, pinned by version | Generates clips on request; internal network only, no published port; `OMP_NUM_THREADS` set to the LXC's vCPU count; about 1.35 GB RAM; if it is stopped, study continues with device voices |
| `backup` | Small cron image | Nightly `pg_dump` into a dumps folder that Backrest backs up, keeping 14 days locally |

**Exposure.** Nginx Proxy Manager is the only way in from the internet: add a proxy host that points at the `app` port on the LXC, with its certificate and forced HTTPS. The app bundles no proxy of its own. The app only needs to know its public URL and to trust the proxy's forwarded headers.

**Sizing.** 2 vCPU, 4 GB RAM and 10 GB disk are ample for 50 accounts with the TTS engine running (it holds about 1.35 GB); 4 vCPU keep first-play generation under a second. At that bitrate, audio for the full N3 course is about 22 MB, well under 1 GB. The media folder is one path in the environment file, so it can sit on the large HDD mount while the database stays on the faster disk.

**Operations**

- Configuration through one `.env` file: public URL, database password, session secret, SMTP settings, time zone for the weekly rollover.
- `GET /healthz` for the proxy or an uptime monitor; structured JSON logs to stdout.
- Backups have two layers: Proxmox Backup Server backs up the whole LXC, and Backrest (restic) backs up the database dumps folder and the media volume on its schedule. A restore script and a tested restore from the Backrest copy are part of the v1 checklist.
- Upgrades: pull the new image and restart; migrations are forward-only and run automatically. The first admin account is created by a one-time CLI command.
- Release images are built by CI and tagged by version, so the server can pin and roll back.

## 13. Testing

Tests concentrate where mistakes hurt learners most: answer checking, scheduling and progress writes.

| Layer | Tool | Covers |
| --- | --- | --- |
| Unit | Jest (with ts-jest) | `core` rules (scheduler, XP, streak edge cases across time zones and freezes), language plugins (table-driven answer-checking cases, romaji conversion, reading stored tiles, merge rules and grammar detection over recorded analyzer tokens) and the segmentation path in `packages/importers` (kuromoji plus the plugin's rules against the word-boundary spike's `gold.tsv`, grammar detection against the sentence spike's sample) |
| API integration | Jest against a real PostgreSQL in a container | Each route group; the lesson-complete and review-answer transactions; idempotency; role checks |
| Component | Testing Library | Each exercise renderer and the lesson player state machine |
| End to end | Playwright | Accept invite, finish a lesson, do reviews, draw a kanji, see the leaderboard, author and publish a lesson |
| Content lint | Custom CLI in CI | Pack validity: schemas, every exercise uses only items taught so far, every character has strokes, every word and sentence has a kana reading (so audio can be generated) or an uploaded clip, no blocked words, no broken links |
| Stroke matching | Recorded stroke fixtures | Hanzi Writer's matcher, at the configured leniency and with our converted KanjiVG data, over the spike's synthetic fixtures and the owner's recorded attempts, so leniency changes cause no regressions |

CI runs lint, type check, unit and integration tests and the content lint on every push; end-to-end tests run before a release image is tagged.

## 14. Spikes and open questions

Four short experiments ran during M0. The owner decided their outcomes on 2026-11-11, and this document reflects them.

| Spike | Question | Outcome |
| --- | --- | --- |
| [TTS engine](spikes/tts.md) (#1) | Which self-hosted engine gives acceptable Japanese on this server? Candidates: Kokoro and VOICEVOX; also the built-in device voices | Kokoro (Kokoro-FastAPI), voice `jf_alpha`, always sent the kana reading; VOICEVOX dropped. Clips are generated on first play (0.2 to 0.4 s at 4 vCPU) and cached; no bulk job. About 1.35 GB RAM, `OMP_NUM_THREADS` = vCPU count. Device voices only as fallback; phone testing deferred |
| [Stroke matching](spikes/stroke-matching.md) (#2) | Is the simple resample-and-compare matcher forgiving enough on a phone? Compare with Hanzi Writer fed Japanese stroke data | Adopt Hanzi Writer (MIT) for animation, checking and hints, fed KanjiVG converted at import to its format; its bundled data is not used. Leniency configurable, starting at 1, confirmed with the owner's recordings. Trace and memory modes both in v1 |
| [Sentence quality](spikes/sentence-quality.md) (#3) | How many Tatoeba sentences survive the "only taught words, short enough" filter per level, and how good are they? | High yield (about 14,600 N5 sentences covering 95% of N5 words). Commit a parsed copy of the tanos lists; add per-level supplementary words; keep the native-owner filter, coverage filter and 15-character limit; automatic grammar-level check; per-language word blocklist; per-sentence attribution |
| [Word boundaries](spikes/word-boundaries.md) (#4) | Is a morphological analyzer (for example kuromoji) good enough to pre-tokenize imported sentences for author review? | Yes: kuromoji plus merge rules, 95 of 100 sample sentences exact. kuromoji runs only in Node (a generic adapter in `packages/importers`, at import and on editor save) and the merge rules live in `packages/lang-ja`; tiles with base form and reading are stored with sentences and authored exercise answers; `tokenize` reads them; authored boundaries win; imported sentences start unreviewed |

**Open questions**

- [ ] Reverse proxy: decided, the existing Nginx Proxy Manager; no bundled proxy.
- [ ] Email: decided, assume SMTP is available at release. No provider is chosen yet, so SMTP settings may stay empty: until then invite links are copied and sent by hand, and password resets use the admin temporary password.
- [ ] Backups: decided, Proxmox Backup Server for the LXC and Backrest (restic) for dumps and media.
- [ ] Host: decided, an LXC.

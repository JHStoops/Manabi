# 4. Software Requirements Specification — Manabi

Source: https://claude.ai/artifact/78eNc7HYMw3ny2rhbnQZUG, exported 2026-11-11

## 1. Introduction

This document states what the Manabi v1 software shall do, as numbered, testable requirements that development and testing work against.

**Scope.** The web app, API server, background worker, Japanese language plugin, dataset importers and deployment package. Authoring the Japanese course content itself is governed by the Product Spec, not by this document.

**Source documents.** Requirements derive from the PRD (requirement ids PR-n), the Product Spec (behavior and rules, exercise ids EX-n) and the Software Design Document (architecture and technology). Where this document gives a number, it overrides a looser statement elsewhere.

**Conventions**

- "Shall" marks a binding requirement. "Should" marks a goal that may slip past v1.
- FR = functional requirement, NFR = non-functional, IF = interface, DR = data.
- Milestones M0 to M3 are those in the PRD; v1.0 means all four.

**Definitions**

| Term | Meaning |
| --- | --- |
| Item | A unit of knowledge: a kana, kanji, word or grammar point |
| Facet | One aspect an item is reviewed on: meaning, reading or listening |
| Stage | An item facet's position (1 to 8) on the spaced-repetition ladder |
| Language plugin | The code package that supplies language-specific behavior |
| Content pack | The files that define a course's sections, units, lessons and items |
| Learner, admin | The two account types. "Author" in this document means an admin doing content work |

## 2. Overall description

Manabi is a self-contained system: one server deployment used through web browsers by a private, invited group.

| Aspect | Description |
| --- | --- |
| Users | Up to 50 accounts; learners of mixed ages and technical skill; one or two admins |
| Client environment | Current and previous major versions of Chrome, Edge, Firefox and Safari on desktop, Android and iOS; screens from 360 px wide |
| Server environment | Linux LXC on Proxmox with Docker Engine and Compose; 2 vCPU, 4 GB RAM (about 1.4 GB of it for the TTS engine), 10 GB disk minimum, 4 vCPU recommended for audio generated on first play; media files may be placed on a separate, larger disk |
| Network | Reached over the public internet only through the existing Nginx Proxy Manager, which terminates HTTPS |
| Design constraints | React frontend built with Vite, styled with Emotion, state in useReducer and useContext; Node backend with Fastify; TypeScript; npm; PostgreSQL through plain SQL with no ORM; Jest for unit and API tests; REST API under `/api/v1`; no required paid or cloud services |
| Assumptions | Learners are online while studying; English is the base and interface language; open datasets remain available under their current licences |
| Out of scope for v1 | Native mobile app, public registration, speech recognition, AI-generated content, offline study, email or push reminders |

## 3. Functional requirements

### 3.1 Accounts and access

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-001 | Create accounts only through a valid, unexpired, unused invite token | PR-70 | M0 |
| FR-002 | Let an admin create an invite with an account type and expiry, email its link, list invites and revoke them | PR-70 | M0 |
| FR-003 | Authenticate by username or email plus password and issue a session valid for 30 days of inactivity | PR-71 | M0 |
| FR-004 | Let a user sign out, list their active sessions and revoke any of them | PR-71 | M0 |
| FR-005 | Support password reset by emailed link, and let an admin set a temporary password; signing in with a temporary password shall require choosing a new password before anything else | PR-71 | M0 |
| FR-006 | Enforce two account types (learner and admin) on every API route; content authoring requires admin | PR-72 | M0 |
| FR-007 | Let a user edit display name, time zone, password and all settings listed in the Product Spec | PR-65 | M1 |
| FR-008 | Let a user export their progress as a JSON file and delete their account and all personal data | PR-76 | v1.0 |
| FR-009 | Provide a command-line action that creates the first admin account | PR-85 | M0 |

### 3.2 Courses and path

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-020 | Represent a course as ordered sections, units and lessons, and show them as a path with each lesson's state (locked, available, completed) | PR-1 | M1 |
| FR-021 | Unlock lessons in order within a unit, and a unit when all lessons of the previous unit are completed or tested out | PR-1 | M1 |
| FR-022 | Show only published units and lessons to learners | PR-74 | M1 |
| FR-023 | Let a learner enroll in several courses and switch the active course | PR-80 | M1 |
| FR-024 | Offer a unit test-out of 20 exercises that completes the unit at 85% or better | PR-5 | v1.x |

### 3.3 Lessons and exercises

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-040 | Support the six lesson types: kana, vocabulary, kanji, grammar, listening, unit review | PR-2 | M1 to M3 |
| FR-041 | Build each lesson session from teaching cards for new items followed by 10 to 15 exercises | PR-3 | M1 |
| FR-042 | Implement exercise types EX-01 to EX-06 (choice, match pairs, word bank, typed answer, fill the blank, reorder) | PR-3 | M1 |
| FR-043 | Implement EX-09 and EX-10 (reading in context, conjugate) | PR-21 | M2 |
| FR-044 | Implement EX-11 and EX-12 (stroke trace, draw from memory) | PR-13 | M2 |
| FR-045 | Implement EX-07 and EX-08 (listen and choose, dictation) | PR-51 | M3 |
| FR-046 | Show feedback within the same screen after each answer. In lessons and review sessions, allow one immediate second attempt after a first wrong answer without revealing the answer, and mark the exercise incorrect, showing the correct answer and an explanation, only if the second attempt is also wrong | PR-4 | M1 |
| FR-047 | Re-present incorrectly answered exercises at the end of the session until answered correctly | PR-4 | M1 |
| FR-048 | Use in an exercise only items taught in the same or an earlier lesson | PR-3 | M1 |
| FR-049 | Generate exercises from item data for kana, vocabulary, kanji and listening lessons, and use authored exercises where present | PR-74 | M1 |
| FR-050 | Preserve an unfinished lesson session for 24 hours and resume it on return | PR-1 | M1 |
| FR-051 | On completion, record lesson progress, create review entries for new items, award XP and update streak in one atomic operation | PR-40, PR-60 | M1 |
| FR-052 | Ignore a repeated completion request carrying the same idempotency key | PR-84 | M1 |
| FR-053 | Re-grade submitted responses on the server using the same rules as the client | PR-4 | M1 |
| FR-054 | Let a learner report an answer they believe should be accepted | PR-4 | M2 |
| FR-055 | Let a learner replay a completed lesson for reduced XP | PR-60 | M1 |
| FR-056 | Draw the sentences of a lesson in a section of level L only from sentences whose stored vocabulary level and grammar level are both at or below L and that an author has not marked challenging (FR-236) | PR-3 | M1 |
| FR-057 | Offer an optional unit challenge once a unit is completed: a session of 10 to 15 exercises built from the unit's challenging sentences, meaning sentences whose words are all taught by the end of the unit, at least one of them in the unit, and whose stored grammar level is exactly one level above the unit's section level and stored vocabulary level at or below it (or that an author marked challenging); do not offer it when the unit has fewer than 5 such sentences; it is never required to complete or unlock anything | PR-8 | M2 |
| FR-058 | Run a unit challenge with the same exercise types, grading, feedback, second attempt and retry round as a lesson; award XP as for a lesson (new-lesson XP and accuracy bonus on first completion, replay XP after), and count answers on learned items that are due as review answers under FR-112, logged per FR-117 | PR-8 | M2 |
| FR-059 | Show each sentence's grammar level and challenge status in the sentence editor and let an author override the challenge status either way | PR-74 | M2 |

### 3.4 Kanji and strokes

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-070 | Provide a detail page per kanji with meanings, on and kun readings, stroke count, radical and components, level, linked words, example sentences and the learner's stage | PR-10 | M2 |
| FR-071 | Play a stroke-order animation for every kanji and kana in the course, with play, step and replay controls | PR-12 | M2 |
| FR-072 | Accept drawn strokes from mouse, touch and stylus and judge each stroke on order, direction and position within a configurable tolerance | PR-13 | M2 |
| FR-073 | In trace mode show the next stroke as a guide; in memory mode show a guide only after 2 failed attempts at a stroke | PR-13 | M2 |
| FR-074 | Let a learner turn drawing exercises off, substituting recognition exercises | PR-13 | M2 |
| FR-075 | Provide a kanji grid filterable by level, stroke count, radical and stage, and searchable by character, meaning and reading | PR-14 | M2 |
| FR-076 | Let a learner save a private note on any item | PR-15 | v1.0 |
| FR-077 | Store each character's stroke data, converted at import from the language's stroke source (KanjiVG for Japanese) into the stroke component's format (an outline and a median per stroke), and use no character data bundled with the stroke component | PR-12, PR-13 | M0 |

### 3.5 Grammar

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-090 | Provide a page per grammar point with pattern, formation table, explanation, examples with audio, and related points | PR-20 | M2 |
| FR-091 | Deliver grammar lessons built from authored exercises of types EX-01, EX-03, EX-05, EX-06, EX-07 and EX-10 | PR-21 | M2 |
| FR-092 | Provide a grammar reference listing all points by level and theme, searchable by pattern and English meaning | PR-22 | M2 |
| FR-093 | Open a word card with reading and meaning when a word in an example sentence is tapped | PR-23 | v1.0 |
| FR-094 | Start a 10-exercise drill on any learned grammar point from its page | PR-21 | v1.0 |

### 3.6 Vocabulary and library

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-100 | Provide a page per word with reading, meanings, part of speech, audio, example sentence and links to its kanji | PR-30, PR-31 | M2 |
| FR-101 | Provide a vocabulary list searchable by Japanese, reading and English, filterable by level and stage | PR-32 | v1.0 |
| FR-102 | Show each item's stage wherever the item appears as a tile | PR-42 | M2 |

### 3.7 Reviews

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-110 | Create a review entry per facet for every item when its lesson is completed | PR-40 | M2 |
| FR-111 | Schedule each facet on the 8-stage ladder with the intervals in the Product Spec, read from configuration | PR-41 | M2 |
| FR-112 | Advance an item one stage only when all its facets are answered correctly in a session; on a wrong answer drop it 1 stage (stages 1 to 4) or 2 stages (stage 5 and above) | PR-41 | M2 |
| FR-113 | Show the count of items due now and a 7-day forecast | PR-42 | M2 |
| FR-114 | Serve review sessions of up to 20 items, oldest due first, and save each answer as it is given | PR-41 | M2 |
| FR-115 | Honor per-learner daily caps on new items and reviews | PR-43 | v1.0 |
| FR-116 | Let a learner reset an item to stage 1 or retire it | PR-42 | v1.0 |
| FR-117 | Record every review answer in an append-only log | PR-41 | M2 |

### 3.8 Audio

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-130 | Provide playable audio for every published word and curated example sentence | PR-50 | M3 |
| FR-131 | Generate a clip through a free, self-hosted TTS provider the first time a word or sentence without a current clip is played, cache it on disk for later plays, and regenerate it when the text or reading changes; no manual recording and no bulk pre-generation job | PR-52 | M3 |
| FR-132 | Let an author upload a recording that replaces a generated clip | PR-52 | M3 |
| FR-133 | Offer playback at normal and 0.75 speed | PR-53 | M3 |
| FR-134 | Let a learner skip listening exercises for 15 minutes without penalty | PR-51 | M3 |
| FR-135 | Fall back to a device speech voice for the course language when no clip can be served (none stored and none can be generated), and hide speaker buttons and skip listening exercises when the device has none | PR-52 | M1 |
| FR-136 | Send the TTS engine the kana reading of a word or sentence, never its written form; a sentence's reading comes from its stored tiles | PR-52 | M3 |

### 3.9 Text display and input

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-140 | Render furigana according to the learner's setting: always, unlearned kanji only, or never | PR-6 | M2 |
| FR-141 | Show romaji only within the kana section | PR-6 | M1 |
| FR-142 | Convert romaji to kana as the learner types in kana answer fields, and accept direct kana input from an IME | PR-7 | M1 |
| FR-143 | Normalize typed answers before comparison as specified in the Product Spec's answer checking rules | PR-7 | M1 |
| FR-144 | Offer a word-bank alternative to typed exercises on small screens | PR-7 | v1.0 |

### 3.10 Gamification

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-160 | Award XP per the Product Spec's XP table and record each award in a ledger | PR-60 | M1 |
| FR-161 | Track a daily XP goal of 10, 20, 30 or 50 chosen by the learner | PR-60 | M1 |
| FR-162 | Track XP total and level separately for each course a learner is enrolled in, each level requiring 100 XP more than the previous | PR-60 | M1 |
| FR-163 | Count a streak day when the learner earns 10 XP or more on a calendar day in their own time zone, summed across all courses | PR-61 | M1 |
| FR-164 | Grant a streak freeze per 7-day run, hold at most 2, and spend one automatically for each missed day | PR-61 | M1 |
| FR-165 | Award achievements when their thresholds are met and show a celebration once | PR-64 | M3 |
| FR-166 | Provide five themes, each in light and dark, selectable per learner | PR-65 | M3 |
| FR-167 | Let a learner turn off sound effects, audio auto-play and animations, and honor the device's reduced-motion setting | PR-65 | M3 |
| FR-168 | Never block study because of mistakes | PR-66 | M1 |
| FR-169 | Grant timed XP boosters of 1.5x, 2x and 3x on the triggers and for the durations in the Product Spec, read from configuration, with at most one active per learner, and show the active multiplier and time remaining | PR-67 | M3 |
| FR-170 | Multiply every XP award by the learner's active booster and record base amount, multiplier and final amount in the ledger | PR-67 | M3 |

### 3.11 Social

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-180 | Show a leaderboard of XP earned in the current week by all opted-in learners | PR-62 | M3 |
| FR-181 | Close the week at Sunday 23:59 server time, store final ranks and badge the top three | PR-62 | M3 |
| FR-182 | Let a learner follow and unfollow any other learner and list followed learners with streak, level, weekly XP and section | PR-63 | M3 |
| FR-183 | Let a learner send one nudge per friend per day, delivered in-app | PR-63 | M3 |
| FR-184 | Let a learner opt out of the leaderboard and of nudges | PR-63 | M3 |

### 3.12 Administration

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-200 | Let an admin list users, change roles, disable accounts and set temporary passwords | PR-73 | M0 |
| FR-201 | Show an admin daily active learners, lessons and reviews completed, and open answer reports | PR-73 | v1.0 |
| FR-202 | Show app version, storage used and last backup time, and start a backup on request | PR-73 | v1.0 |
| FR-203 | Expose an unauthenticated health endpoint reporting API and database status | PR-85 | M0 |

### 3.13 Authoring and imports

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-220 | Let an author create, edit, reorder and delete sections, units and lessons | PR-74 | M1 |
| FR-221 | Let an author edit items, storing edits as overrides that survive re-import | PR-74 | M1 |
| FR-222 | Let an author write grammar points with formation table, explanation and marked-up example sentences | PR-74 | M2 |
| FR-223 | Let an author write, edit, pin and remove exercises, with payloads validated per exercise type | PR-74 | M1 |
| FR-224 | Preview a lesson exactly as a learner would see it, without recording progress | PR-74 | M1 |
| FR-225 | Keep draft and published states per unit and lesson; publishing changes shall not alter existing learner progress | PR-74 | M1 |
| FR-226 | Import KANJIDIC2, JMdict, KanjiVG, Tatoeba and level lists idempotently, recording each run | PR-75 | M0 |
| FR-227 | Import a content pack into the database and export the database to a content pack | PR-80 | M0 |
| FR-228 | Validate a content pack and report schema errors, untaught items used in exercises, missing strokes, and words or sentences with neither an uploaded clip nor a kana reading to generate one from | PR-74 | M1 |
| FR-229 | Let an author accept or dismiss answer reports; accepting adds the answer to the exercise's accept list | PR-74 | M2 |
| FR-230 | Show dataset names, versions and licences on an About page | PR-75 | v1.0 |
| FR-231 | Include a content authoring guide in the repository covering data sources and licences, pack structure with worked examples, conventions, the procedure for adding a level and the validation command, sufficient for Claude or a person to add a new level | PR-77 | v1.0 |
| FR-232 | Leave every learner's lesson completion, review stages, XP, level and streak unchanged when a content pack is updated or expanded; archive content removed from a pack instead of deleting it; never re-lock a completed unit because lessons were added to it | PR-87 | M0 |
| FR-233 | Import the JLPT level lists from a parsed copy committed in the repository with its credit, making no request to the lists' source site | PR-75 | M0 |
| FR-234 | Keep a supplementary common-words list per level, seeded with the missing words that block the most imported sentences and editable by an admin, and treat its words as level-list words in vocabulary import and sentence filtering | PR-74, PR-75 | M0 |
| FR-235 | Import a Tatoeba sentence only if it has a direct English translation, contains no Latin letters, is at most 15 characters long excluding spaces and punctuation, uses only content words at or below its level (level lists plus supplementary words), and its owner declares the sentence's language as native in Tatoeba's user languages export; store it as unreviewed | PR-75 | M0 |
| FR-236 | Detect the course's grammar points in each imported sentence from each point's detection patterns, matched by the language plugin over the analyzer's tokens; store the sentence's grammar level as the highest level among its detected points (none when no point is detected); never drop or flag a sentence because of its grammar. A sentence whose grammar level is above its vocabulary level (its stored vocabulary level, the highest level among its content words) is challenging, unless an author has overridden that status | PR-75 | M0 |
| FR-237 | Keep a word blocklist per language, empty at start and editable by an admin; skip imported sentences containing a blocked word, and report blocked words in authored sentences and exercises in pack validation and in the editors | PR-74, PR-75 | M0 |
| FR-238 | Split each imported sentence, and the answer text of authored exercises when a pack is imported or an author saves them, into word tiles in Node with the language plugin's segmentation rules over a morphological analyzer (for Japanese, kuromoji plus merge rules), storing each tile's base form and reading; let authors edit the tiles and never overwrite tiles an author has edited or reviewed | PR-23, PR-74, PR-75 | M0 |
| FR-239 | Show a source credit (source id, owner and licence, linked to the source) next to every imported sentence and its translation wherever they are shown | PR-75 | v1.0 |

### 3.14 Language extensibility

| ID | The system shall | Traces | Milestone |
| --- | --- | --- | --- |
| FR-240 | Route all language-specific behavior (normalizing, answer checking, input conversion, tokenizing, segmentation rules, grammar detection, annotation, exercise generation, review facets, voice) through the language plugin interface; Node-only analyzers are generic adapters that the plugin selects and that hold no language rules | PR-80 | M0 |
| FR-241 | Show character study, stroke drawing and reading-annotation features only when the active course's plugin enables them | PR-81 | M2 |
| FR-242 | Allow a second course to be added by registering a plugin and importing a content pack, with no change to core, API or web application code (a new analyzer adapter in the importers package is allowed if the language needs one) | PR-80 | v1.0 |
| FR-243 | Keep all interface text in a translation catalog | PR-82 | M1 |
| FR-244 | Treat levels and sections as data, so that N2 and N1 sections can be added to the Japanese course by importing content alone | PR-80 | v1.0 |

## 4. External interface requirements

| ID | Requirement | Traces |
| --- | --- | --- |
| IF-01 | The user interface shall be a responsive single-page web app usable from 360 px to desktop widths, with a bottom tab bar below 768 px and a side rail above | PR-83 |
| IF-02 | The web app shall be installable to a device home screen (web app manifest and service worker) | PR-83 |
| IF-03 | Every interactive control shall be operable by keyboard and have a tap target of at least 44 px | PR-65 |
| IF-04 | All client functionality shall be available through a REST API under `/api/v1` exchanging JSON | PR-84 |
| IF-05 | The API shall publish an OpenAPI description of every route at `/api/v1/openapi.json` | PR-84 |
| IF-06 | The API shall accept the session token as a cookie or as a bearer header | PR-84 |
| IF-07 | API errors shall use one JSON shape with a machine-readable code | PR-84 |
| IF-08 | The server shall run behind Nginx Proxy Manager, trusting its standard `X-Forwarded-*` headers | PR-85 |
| IF-09 | The system shall call the TTS engine only through the provider interface, over the internal network | PR-52 |
| IF-10 | The system shall send email only through an SMTP server supplied in configuration; with no SMTP server configured, invites shall be offered as links to copy and password resets shall use admin-set temporary passwords | PR-71 |
| IF-11 | The system shall require no hardware beyond the server; drawing shall work with mouse, touch or stylus | PR-13 |

## 5. Non-functional requirements

Performance targets assume the minimum server in section 2 and 10 learners active at once.

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-01 | Performance | 95% of API requests shall complete in under 300 ms at the server |
| NFR-02 | Performance | Starting a lesson or review session shall take under 1 second at the server |
| NFR-03 | Performance | Answer feedback shall appear in under 100 ms, without a network round-trip |
| NFR-04 | Performance | First load on a mid-range phone over a 10 Mbps connection shall be interactive in under 3 seconds; the initial JavaScript shall stay under 250 kB compressed |
| NFR-05 | Performance | Stroke drawing shall track the pointer at 60 frames per second on a mid-range phone |
| NFR-08 | Performance | A clip generated on first play shall be ready in under 1 second at the server with 4 vCPU, excluding TTS engine start-up |
| NFR-06 | Capacity | The system shall support 50 accounts, 5,000 items per course and 5 million review-log rows without tuning |
| NFR-10 | Security | Passwords shall be stored only as Argon2id hashes; session, invite and reset tokens only as hashes |
| NFR-11 | Security | All traffic shall use HTTPS; cookies shall be `HttpOnly`, `Secure` and `SameSite=Lax` |
| NFR-12 | Security | Login, invite and reset routes shall be rate limited to 10 attempts per 15 minutes per IP and per username |
| NFR-13 | Security | Every request body, query and path parameter shall be validated against a schema |
| NFR-14 | Security | A learner shall be unable to read or change another learner's progress, notes or settings |
| NFR-15 | Security | Only the app's HTTP port shall be reachable from outside the Docker network, and it shall be exposed to the internet only through Nginx Proxy Manager |
| NFR-20 | Reliability | Progress writes shall be atomic: a failed request leaves no partial lesson, XP or review state |
| NFR-21 | Reliability | A database dump shall be written nightly and kept 14 days, in a folder that the server's Backrest schedule backs up together with the media files |
| NFR-22 | Reliability | Restore from backup to a working system shall take under 30 minutes following the documented steps |
| NFR-23 | Reliability | The app shall remain usable for study while the TTS engine or worker is stopped |
| NFR-30 | Accessibility | Text and controls shall meet WCAG 2.1 AA contrast in every theme and mode |
| NFR-31 | Accessibility | Correctness and item stage shall never be conveyed by color alone |
| NFR-32 | Usability | A new learner shall be able to accept an invite and finish a first lesson in under 5 minutes without help |
| NFR-40 | Compatibility | The web app shall work on the current and previous major versions of Chrome, Edge, Firefox and Safari, desktop and mobile |
| NFR-41 | Portability | The server shall run from published container images with one Compose file and one environment file |
| NFR-50 | Maintainability | All code shall be TypeScript in strict mode, linted and formatted in CI |
| NFR-51 | Maintainability | `core` and language plugin packages shall have at least 85% line coverage; answer-checking rules shall be covered by table-driven tests |
| NFR-52 | Maintainability | Database changes shall be made only through versioned, forward-only migrations |
| NFR-53 | Maintainability | A new exercise type shall be addable by one registry entry, one grader and one renderer |
| NFR-60 | Privacy | The client shall make no requests to third-party hosts; no analytics or tracking shall be included |
| NFR-61 | Privacy | The only personal data stored shall be username, display name, email, time zone, settings and learning activity |
| NFR-62 | Licensing | Attribution and licence for each imported dataset shall be stored with the data and displayed in the app |
| NFR-07 | Storage | Generated audio shall be stored as mono Opus at 32 kbps or less with silence trimmed, from the first clip generated; the media folder location shall be configurable so it can sit on a separate disk |

## 6. Data requirements

| ID | Requirement |
| --- | --- |
| DR-01 | All persistent state shall live in PostgreSQL, except audio and backup files on a mounted volume |
| DR-02 | Every item shall have a stable, unique key that does not change across imports or pack export and import |
| DR-03 | Learner progress shall reference items by id and shall survive content edits, re-imports and republishing |
| DR-04 | The XP ledger and review log shall be append-only; cached totals shall be rebuildable from them |
| DR-05 | Timestamps shall be stored in UTC; each XP event shall also store the learner's local calendar date |
| DR-06 | Language-specific item fields shall be stored as JSON validated against the plugin's schema on every write |
| DR-07 | Deleting an account shall remove the user's sessions, progress, logs, notes, follows and nudges, and anonymize their answer reports |
| DR-08 | Expired sessions, invites, reset tokens and lesson sessions shall be purged by a scheduled job |
| DR-09 | Imported data shall keep its source and dataset version; author overrides shall be stored separately from imported values |
| DR-10 | A learner's export shall include profile, settings, lesson progress, item stages, XP history and notes in documented JSON |
| DR-11 | Each imported sentence and its translation shall store, separately, the source sentence id, the owner's username (or none), the source URL, the licence, the dataset version and whether Manabi has edited it; an author edit to the text or translation shall set that flag |
| DR-12 | A sentence's tiles shall be stored with it, each with surface text, base form, reading and linked item id where known, together with a review status (unreviewed, flagged or reviewed) and any grammar points detected at import. Authored exercise answer text shall store its tiles, in the same tile shape, in the exercise payload |
| DR-13 | Each sentence shall store its vocabulary level (`vocab_level_code`: the highest level among its content words, set at import by the FR-235 coverage check and recomputed when its tiles change), its grammar level (`grammar_level_code`: the highest level among its detected grammar points, none when none is detected) and an optional author override of its challenge status (`challenge_override`: none means the status is derived by comparing `vocab_level_code` and `grammar_level_code`) |

## 7. Verification and v1 acceptance

Each requirement is verified by the cheapest method that gives confidence.

| Method | Applies to |
| --- | --- |
| Automated unit tests | Scheduler, XP, streak, answer checking, input conversion, sentence segmentation against the spike's gold tiles, grammar detection (FR-111, 112, 143, 160 to 164, 236, 238) |
| Automated API tests | All FR in 3.1 to 3.3, 3.7, 3.11 to 3.13; NFR-13, 14, 20 |
| End-to-end tests | Invite to first lesson, review session, kanji drawing, leaderboard, author and publish |
| Load script | NFR-01, 02, 06 with 10 simulated learners |
| Manual check on real devices | Stroke drawing, audio, themes, accessibility (FR-072, NFR-05, 30 to 32, 40) |
| Operational drill | Fresh install from the Compose file; backup and restore (NFR-21, 22, 41) |

**v1.0 acceptance checklist**

- [ ] Fresh deployment on the home server from the published images succeeds with only the environment file edited.
- [ ] An invited learner on a phone completes the first kana lesson within 5 minutes of opening the invite link.
- [ ] The kana section and all N5 units are published, with stroke data for every character and audio for every item (uploaded, cached or generated on first play).
- [ ] A learner can complete a vocabulary, kanji, grammar and listening lesson and a unit review.
- [ ] Items from completed lessons come due and move through stages as specified.
- [ ] Drawing a kanji from memory works with finger and mouse.
- [ ] Streak, freeze, level, achievements and the weekly leaderboard behave as specified across a simulated two-week period.
- [ ] A stub second-language pack and plugin load and run a lesson with no change to core, API or web code.
- [ ] A restore from last night's backup reproduces all learner progress.
- [ ] No requirement marked M0 to M3 is failing its automated tests.

## 8. Traceability

Every PRD requirement maps to at least one requirement here.

| PRD | Topic | SRS requirements |
| --- | --- | --- |
| PR-1 | Path of units and lessons | FR-020, FR-021, FR-050 |
| PR-2 | Lesson types | FR-040 |
| PR-3 | Mixed exercise types | FR-041, FR-042, FR-048, FR-056 |
| PR-4 | Immediate feedback, retry | FR-046, FR-047, FR-053, FR-054 |
| PR-5 | Unit test-out | FR-024 |
| PR-6 | Furigana and romaji display | FR-140, FR-141 |
| PR-7 | Typing Japanese | FR-142, FR-143, FR-144 |
| PR-8 | Unit challenges | FR-057, FR-058 |
| PR-10 | Kanji detail page | FR-070 |
| PR-11 | Kanji lessons | FR-040, FR-043, FR-049 |
| PR-12 | Stroke animation | FR-071, FR-077 |
| PR-13 | Drawing practice | FR-044, FR-072, FR-073, FR-074, FR-077, IF-11 |
| PR-14 | Kanji dictionary | FR-075 |
| PR-15 | Personal notes | FR-076 |
| PR-20 | Grammar explanations | FR-090 |
| PR-21 | Grammar drills | FR-043, FR-091, FR-094 |
| PR-22 | Grammar reference | FR-092 |
| PR-23 | Tap-to-define words | FR-093, FR-238, DR-12 |
| PR-30, PR-31 | Word entries and kanji links | FR-100 |
| PR-32 | Vocabulary dictionary | FR-101 |
| PR-40 | Items enter reviews | FR-051, FR-110 |
| PR-41 | Review queue and scheduling | FR-111, FR-112, FR-114, FR-117 |
| PR-42 | Strength and forecast | FR-102, FR-113, FR-116 |
| PR-43 | Daily caps | FR-115 |
| PR-50 | Audio everywhere | FR-130 |
| PR-51 | Listening exercises | FR-045, FR-134 |
| PR-52 | Self-hosted audio | FR-131, FR-132, FR-135, FR-136, IF-09, NFR-08 |
| PR-53 | Slow playback | FR-133 |
| PR-60 | XP, goal, levels | FR-055, FR-160, FR-161, FR-162 |
| PR-61 | Streak and freeze | FR-163, FR-164 |
| PR-62 | Weekly leaderboard | FR-180, FR-181 |
| PR-63 | Friends | FR-182, FR-183, FR-184 |
| PR-64 | Achievements | FR-165 |
| PR-65 | Themes, motion, no mascots | FR-007, FR-166, FR-167, IF-03, NFR-30, NFR-31 |
| PR-66 | No hearts | FR-168 |
| PR-70 | Invite-only registration | FR-001, FR-002 |
| PR-71 | Sign-in and reset | FR-003, FR-004, FR-005, IF-10 |
| PR-72 | Roles | FR-006 |
| PR-73 | Admin console | FR-200, FR-201, FR-202 |
| PR-74 | Content editor | FR-022, FR-049, FR-220 to FR-225, FR-228, FR-229, FR-234, FR-237, FR-238, FR-059 |
| PR-75 | Dataset importer | FR-226, FR-230, FR-233 to FR-239, DR-11, DR-12, DR-13, NFR-62 |
| PR-76 | Export and delete | FR-008, DR-07, DR-10 |
| PR-80 | Languages as packs and plugins | FR-023, FR-227, FR-240, FR-242, FR-244 |
| PR-81 | Script features per language | FR-241 |
| PR-82 | Translatable interface | FR-243 |
| PR-83 | Responsive, installable | IF-01, IF-02, NFR-40 |
| PR-84 | API for a mobile client | FR-052, IF-04 to IF-07 |
| PR-85 | Container deployment and backups | FR-009, FR-203, IF-08, NFR-21, NFR-22, NFR-41 |
| PR-86 | Safe on the internet | NFR-10 to NFR-15 |
| PR-77 | Content authoring guide | FR-231 |
| PR-67 | XP boosters | FR-169, FR-170 |
| PR-87 | Pack updates keep progress | FR-232, DR-03 |

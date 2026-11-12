# 1. Product Requirements Document — Manabi

Source: https://claude.ai/artifact/YLLabjSbHVsqXYVh2ubVQq, exported 2026-11-11

## 1. Overview

Manabi is a self-hosted, Duolingo-style language learning web app that puts vocabulary, grammar and deep kanji study in one place, starting with Japanese. "Manabi" (learning) is the app's name.

**Problem.** Studying Japanese today takes three apps: one for kanji (meanings, readings, sample words), one for sentence structure and grammar, and Duolingo for basic vocab and practice. Progress, streaks and review schedules are split across all three, and none of them knows what the others taught.

**Vision.** One app, hosted on the home server, where a family member or friend opens a single learning path and gets lessons, kanji study, grammar lessons and scheduled reviews that all share one record of what they know.

**Decisions already made**

| Topic | Decision |
| --- | --- |
| First language | Japanese, taught from English |
| Course depth | Kana through JLPT N3 for now; the structure must allow N2 and N1 content to be added later without code changes |
| Content source | Open datasets for kanji, vocab and sentences; grammar lessons hand-authored in an admin editor |
| Access | Reachable over the internet, invite-only accounts |
| Look and feel | Gamified and colorful like Duolingo, with no mascot characters |
| Platform | Web app first; a mobile app must remain possible later |
| Stack | ReactJS frontend, NodeJS backend |
| v1 features | Spaced-repetition reviews, audio and listening, kanji stroke drawing, leaderboards and friends |
| Extensibility | Adding a new language must not require changing application code |

## 2. Goals, non-goals and success measures

**Goals**

- G1. Replace the three-app routine: a learner can study vocab, grammar and kanji for Japanese without leaving Manabi.
- G2. Make kanji a first-class subject: meaning, on and kun readings, stroke order, radicals and sample words for every kanji taught.
- G3. Teach grammar explicitly, with dedicated lessons and drills per grammar point instead of only absorbing it through sentences.
- G4. Keep the daily habit: streaks, XP, levels, leagues and friends keep a small group coming back.
- G5. Run comfortably on one home server and be maintainable by one developer.
- G6. Support more languages later through content packs and language plugins, not rewrites.
- G7. Expose everything through an API so a mobile app can be added later.

**Non-goals for v1**

- A native mobile app (the web app is responsive and installable instead).
- Public sign-up, payments, subscriptions or ads.
- Mascot characters, animated stories or voiced character dialogue.
- Speech recognition and pronunciation scoring.
- AI-generated lessons or an AI tutor (parked in the ideas backlog).
- Teaching from a base language other than English.
- Scaling beyond roughly 50 accounts.

**Success measures**

| Measure | Target |
| --- | --- |
| Owner stops using the other three apps for daily study | Within 4 weeks of v1 |
| Invited learners still active after 30 days | At least half |
| Median daily session | 10 minutes or more |
| Adding a second language | Content pack plus one language plugin; no changes to core code |
| Operations effort | Under 1 hour a month, backups automated |

## 3. Users

Manabi serves a small private group: one owner and the family and friends the owner invites.

| Persona | Who | Needs |
| --- | --- | --- |
| Owner / admin | Runs the home server, builds the app, also a learner | Deploy and back up easily, invite people, import data, author grammar lessons, see that the app is healthy |
| Committed learner | Studies daily, wants real progress toward N4/N3 | Deep kanji and grammar, reliable review schedule, unit test-outs so known material can be skipped |
| Casual learner | Family or friend, 5 to 10 minutes on a phone | Short lessons, clear next step, streaks and friendly competition, no setup |
| Content author | Any admin; there is no separate author role | An editor for units, lessons and exercises with preview, without touching code |

All learners are assumed to read English. The app does not track whether a learner is a child; it collects only a display name, email and login details, and social features stay inside the invited group.

## 4. Product requirements

Each requirement has an ID that the Product Spec, SDD and SRS trace back to. Priority: **Must** = v1 cannot ship without it, **Should** = v1 if time allows, **Could** = later.

### 4.1 Learning path and lessons

| ID | Requirement | Priority |
| --- | --- | --- |
| PR-1 | A course is a path of units; each unit holds short lessons (3 to 7 minutes) that unlock in order | Must |
| PR-2 | Lessons come in distinct types: vocabulary, grammar, kanji, kana, listening, and mixed unit review | Must |
| PR-3 | Lessons mix several exercise types (multiple choice, word-bank sentence building, typed answer, matching pairs, fill in the blank, listening, drawing) | Must |
| PR-4 | Immediate feedback on every answer. In lessons and reviews, a wrong answer gets one immediate second try before it is marked incorrect; after that the correct answer and a short explanation are shown; missed items repeat before the lesson ends | Must |
| PR-5 | A per-unit "test out" lets learners skip material they know (a placement test is parked in the ideas backlog) | Should |
| PR-6 | Learners choose how Japanese is displayed: furigana on, off, or only for kanji not yet learned; romaji only in the kana stage | Must |
| PR-7 | Typed Japanese answers work with a standard IME and with built-in romaji-to-kana conversion | Must |
| PR-8 | After finishing a unit, learners can take an optional challenge that practices the unit's words in sentences whose grammar is one level ahead; normal lessons use only sentences at or below their level | Should |

### 4.2 Kanji

| ID | Requirement | Priority |
| --- | --- | --- |
| PR-10 | Every kanji has a detail page: meanings, on and kun readings, stroke count, radical and components, JLPT level, sample words with readings, example sentences | Must |
| PR-11 | Kanji lessons teach meaning, then readings, then words that use the kanji | Must |
| PR-12 | Animated stroke order for every kanji and kana | Must |
| PR-13 | Draw-the-character practice on touch or mouse, with stroke-by-stroke checking | Must |
| PR-14 | A browsable, searchable kanji dictionary filtered by level, radical and learning status | Must |
| PR-15 | Learners can attach a personal mnemonic or note to a kanji or word | Should |

### 4.3 Grammar

| ID | Requirement | Priority |
| --- | --- | --- |
| PR-20 | Each grammar point has a written explanation: pattern, formation rules, nuance, and annotated example sentences | Must |
| PR-21 | Grammar lessons drill the point with targeted exercises: particle choice, conjugation, sentence reordering, translation | Must |
| PR-22 | A grammar reference lists every point by level, searchable, readable outside a lesson | Must |
| PR-23 | Example sentences can be tapped word by word to see reading and meaning | Should |

### 4.4 Vocabulary

| ID | Requirement | Priority |
| --- | --- | --- |
| PR-30 | Words are taught in themed sets with reading, meaning, part of speech, audio and an example sentence | Must |
| PR-31 | A word's entry links to the kanji it contains, and a kanji's page links to its words | Must |
| PR-32 | A searchable dictionary of every word in the course | Should |

### 4.5 Reviews (spaced repetition)

| ID | Requirement | Priority |
| --- | --- | --- |
| PR-40 | Every kanji, word and grammar point a learner finishes enters a spaced-repetition schedule | Must |
| PR-41 | A daily review queue shows what is due; correct answers push an item further out, wrong answers bring it back sooner | Must |
| PR-42 | Learners see each item's strength and a forecast of upcoming reviews | Should |
| PR-43 | Learners can cap daily new items and reviews | Should |

### 4.6 Audio

| ID | Requirement | Priority |
| --- | --- | --- |
| PR-50 | Every word and example sentence can be played aloud | Must |
| PR-51 | Listening exercises: hear it, then pick or type what was said | Must |
| PR-52 | Audio is free and needs no recording by the owner: clips are generated on the home server by an open-source voice, with the voice built into the learner's device as fallback; no paid cloud service is required | Must |
| PR-53 | Slow playback option | Should |

### 4.7 Gamification and social

| ID | Requirement | Priority |
| --- | --- | --- |
| PR-60 | XP for lessons and reviews, a daily XP goal, and levels. XP totals and level are tracked per language (a learner can be level 40 in Japanese and level 75 in Spanish); the streak and daily goal are shared | Must |
| PR-61 | Daily streak with a streak freeze | Must |
| PR-62 | Weekly leaderboard across the invited group | Must |
| PR-63 | Friends: follow other learners, see their streak and weekly XP | Must |
| PR-64 | Achievements for milestones (first 100 kanji, 30-day streak, unit completed) | Should |
| PR-65 | Colorful selectable themes, light and dark; celebration animations and sounds that can be turned off; no mascot characters | Must |
| PR-66 | No hearts or lives: mistakes never block study | Must |
| PR-67 | Timed XP boosters of 1.5x, 2x and 3x, earned through play, multiply all XP earned while active | Must |

### 4.8 Accounts and administration

| ID | Requirement | Priority |
| --- | --- | --- |
| PR-70 | Invite-only registration by link or code issued by an admin | Must |
| PR-71 | Sign-in with username or email and password; self-service password reset by email. In case email is unavailable, an admin can set a temporary password, and the learner is prompted to choose a new one when they sign in with it | Must |
| PR-72 | Two account types: admin and learner. Admins also do all content authoring | Must |
| PR-73 | Admin console: manage users and invites, see activity, trigger backups | Must |
| PR-74 | Content editor for courses, units, lessons, grammar points and exercises, with preview and draft/published states | Must |
| PR-75 | Dataset importer for kanji, vocab, sentences and stroke data | Must |
| PR-76 | Learners can export or delete their own data | Should |
| PR-77 | A content authoring guide, written while building the N5 content, gives Claude or a person everything needed to add later levels: data sources, data structure, conventions, worked examples and validation steps | Must |

### 4.9 Multi-language and platform

| ID | Requirement | Priority |
| --- | --- | --- |
| PR-80 | Courses are data: a new language is added as a content pack, with language-specific behavior (script handling, answer checking, text-to-speech voice) isolated in a plugin | Must |
| PR-81 | Script-specific features (kanji study, furigana, stroke drawing) switch on per language and can be reused, for example for Chinese hanzi | Must |
| PR-82 | The interface text is translatable | Should |
| PR-83 | Responsive web app that works on phones, tablets and desktops, installable to the home screen | Must |
| PR-84 | All features are reachable through a documented API so a mobile client can be built later | Must |
| PR-85 | Deploys on the home server as containers, with one command to start and automated backups | Must |
| PR-86 | Safe to expose to the internet: HTTPS, rate-limited sign-in, no public registration | Must |
| PR-87 | Updating or expanding a content pack (for example adding N4 to a course that had kana and N5) never resets or changes a learner's existing progress, reviews, XP, level or streak | Must |

## 5. Release scope

v1.0 ships the full platform with Japanese content through N5, as the proof of concept. N4 and N3 are part of the planned course and follow as content releases once the app is proven on N5; N2 and N1 are later additions. None of these content releases need new code.

| Release | What it adds |
| --- | --- |
| M0 Foundation | Accounts and invites, course data model, dataset import, deployment on the home server |
| M1 Core loop | Learning path, lesson player with the core exercise types, kana course, XP and streaks |
| M2 Depth | Kanji pages and lessons, stroke animation and drawing, grammar lessons and reference, spaced-repetition reviews |
| M3 Sound and social | Audio and listening exercises, leaderboard, friends, achievements, themes |
| v1.0 | M0 to M3 complete, Japanese kana plus N5 content published, content authoring guide written, family invited |
| v1.x content | N4, then N3 units; unit test-outs; dictionary polish |
| v2 candidates | N2 and N1 content, second language, mobile app, items from the ideas backlog |

**Japanese course size (approximate, for planning)**

| Stage | Kanji (cumulative) | Vocabulary (cumulative) | Grammar points |
| --- | --- | --- | --- |
| Kana | 0 | about 100 | Basic sentence pattern only |
| N5 | about 100 | about 800 | about 75 |
| N4 | about 300 | about 1,500 | about 130 more |
| N3 | about 650 | about 3,700 | about 180 more |

The JLPT publishes no official lists, so these counts follow widely used community lists and are a guide, not a contract.

## 6. Constraints, assumptions and risks

**Constraints**

- ReactJS frontend and NodeJS backend.
- Runs on the existing Proxmox home server in an LXC, reached only through the existing Nginx Proxy Manager, with no required paid services.
- One developer, part time.
- Internet-facing, so security basics are not optional.

**Assumptions**

- Up to about 50 accounts and 10 people studying at once.
- Learners have a modern browser and a connection to the server; offline study is not required in v1.
- English is the only base language in v1.

**Open data and licences** (from memory; confirm each licence text at import time)

| Dataset | Used for | Licence | Obligation |
| --- | --- | --- | --- |
| KANJIDIC2 (EDRDG) | Kanji meanings, readings, stroke counts, levels | CC BY-SA 4.0 | Attribution; share-alike on derived data |
| JMdict (EDRDG) | Vocabulary, readings, parts of speech | CC BY-SA 4.0 | Attribution; share-alike |
| KanjiVG | Stroke order paths for animation and drawing checks | CC BY-SA 3.0 | Attribution; share-alike |
| Tatoeba | Example sentences with English translations | CC BY 2.0 FR | Attribution per sentence source |
| JLPT Resources lists by Jonathan Waller (tanos.co.uk) | Assigning kanji, vocab and grammar to N5 to N3; the site is offline, so a parsed copy is kept in the repository | CC BY | Attribution |

The app needs an About page crediting these sources. A private family deployment is low risk, but share-alike matters if the content packs are ever published.

**Risks**

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Authoring roughly 385 grammar points is the largest effort in the project | Content lags the platform | Ship N5 first; make the editor fast; write the authoring guide (PR-77) so Claude can draft later levels for review |
| Scope creep from chasing Duolingo parity | v1 never ships | Milestones above; everything else goes to the backlog |
| Free-text answer checking is hard for Japanese (kana vs kanji, multiple valid translations) | Correct answers marked wrong | Accept lists per exercise, kana normalization, prefer word-bank and choice exercises for translation, "my answer was right" report button |
| Tatoeba sentence quality varies | Confusing examples | Import only short sentences by native-speaker contributors whose words are in the course; sentences with grammar above their level are kept out of normal lessons and used in optional unit challenges; word blocklist; author review |
| Internet exposure of a home server | Account or server compromise | Invite-only, rate limiting, Nginx Proxy Manager in front, regular updates, backups |
| Text-to-speech quality for Japanese pitch and readings | Wrong or robotic audio | Send the engine the kana reading, never the written form; cache each clip after its first play; allow an author to replace any clip |

## 7. Feature ideas backlog

None of these are in v1; they are parked here to draw from later. Add to the list freely.

| Area | Idea |
| --- | --- |
| AI | Local-LLM (Ollama) drafting of grammar explanations and exercises for author review |
| AI | Conversation practice or a tutor that explains a missed answer |
| AI | Free-translation grading by a local model instead of accept lists |
| Speaking | Speech recognition for read-aloud and shadowing exercises |
| Speaking | Pitch accent display and drills |
| Reading | Graded short stories and dialogues with tap-to-define words |
| Reading | Paste any Japanese text and get furigana, definitions and "add to my reviews" |
| Kanji | Radical and component lessons, with mnemonics built from components |
| Kanji | Similar-kanji confusion drills |
| Kanji | Handwriting recognition search in the dictionary |
| Grammar | Conjugation trainer (verb and adjective forms on demand) |
| Grammar | Counters and number drills; keigo track |
| Vocab | Custom word lists and personal decks; Anki import and export |
| Vocab | Japanese-keyboard typing practice |
| Tests | Timed JLPT-style mock tests per level |
| Gamification | Daily and weekly quests, family team goals, timed challenge modes |
| Gamification | Cosmetic unlocks (themes, profile badges) bought with earned gems |
| Social | Activity feed with reactions; parent view of a child's progress |
| Habit | Email or push reminders; weekly progress email |
| Platform | Native mobile app; offline lessons that sync later |
| Platform | Single sign-on with the home server's identity provider |
| Languages | Second course (for example Chinese, Korean or Spanish); base languages other than English |
| Content | Shareable course packs so friends running their own server can import yours |
| Insights | Personal stats: accuracy by exercise type, weakest kanji, time studied |
| Onboarding | Placement test at first sign-in that suggests a starting unit |

## 8. Defaults assumed and open questions

**Defaults I assumed** (change any of these and the later docs follow)

- No hearts or lives system; mistakes cost nothing but repetition.
- English is the only base language and interface language in v1.
- Audio comes from free text-to-speech: clips generated on the home server and cached, falling back to the voice built into the learner's device. Nothing is recorded by hand.
- Speech recognition is out of v1.
- The leaderboard is one weekly board for the whole invited group, not tiered leagues.
- v1 launches with kana plus N5 content; N4 and N3 arrive as content updates.

**Open questions**

- [x] Final name for the app: decided, Manabi.
- [ ] Who authors content: decided. Two account types, admin and learner; admins author.
- [ ] Email: decided. Assume email is available at release for invites and password resets.
- [ ] Child accounts: decided. Not tracked.
- [ ] JLPT level lists: decided. Jonathan Waller's JLPT Resources lists (tanos.co.uk), which cover vocabulary, kanji and grammar for N5 through N1 under CC BY.

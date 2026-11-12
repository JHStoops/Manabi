# Spike: stroke matcher tolerance on phones

Issue #2. Requirements: FR-072 (judge drawn strokes from mouse, touch and stylus on order, direction and position within a configurable tolerance), FR-073 (trace mode guide; memory mode guide after 2 failed attempts), NFR-05 (60 frames per second pointer tracking on a mid-range phone), IF-11 (mouse, touch or stylus, no extra hardware). Rules: SDD section 9 (Stroke canvas) and section 14 (Stroke matching), Product Spec section 5 (Drawing canvas).

**Status:** decided 2026-11-11: **adopt Hanzi Writer** (see [Decision](#decision)). The custom matcher prototype, the synthetic fixtures, the comparison and the phone test page are kept as findings. The owner's real recordings are attached to issue #2 and are to be used in the implementation issue to confirm the leniency setting.

## Summary

- The simple matcher from the SDD (resample to N points, then compare start point, end point, overall direction and average distance, with tolerances as fractions of canvas size) separates good from bad strokes cleanly on synthetic data. At the recommended tolerances it accepts **99.7%** of good strokes and **90.8%** of deliberately sloppy ones, and accepts **0%** of 630 bad strokes (reversed, wrong order, wrong shape, misplaced).
- Recommended starting tolerances (the "lenient" preset, now `DEFAULT_TOLERANCES` in the prototype):

  | Check                                                   | Tolerance                                   |
  | ------------------------------------------------------- | ------------------------------------------- |
  | Start point distance                                    | 0.20 of canvas size                         |
  | End point distance                                      | 0.20 of canvas size                         |
  | Average distance between corresponding resampled points | 0.13 of canvas size                         |
  | Overall direction                                       | 60°                                         |
  | Minimum length (to ignore taps)                         | 0.3 of the expected stroke's length         |
  | Resample points N                                       | 32 (16 to 64 make no measurable difference) |

- Hanzi Writer 3.7.3, fed the same KanjiVG strokes, is slightly more forgiving at its default leniency (100% good, 96.1% sloppy, 0% bad). Above leniency 1 it starts accepting misplaced and straightened strokes (18.9% false accepts at 1.5).
- **Build vs adopt: decided 2026-11-11, adopt Hanzi Writer** (owner's call). See [Decision](#decision).
- **Real attempts:** the owner recorded real attempts with the test page and attached them to issue #2 (`stroke-attempts-2026-11-11T15-54-23-737Z.json`). They are not processed in this spike. The implementation issue should use them to confirm the leniency setting. The 60 fps (NFR-05) phone measurement was not recorded here and moves to the implementation issue.

## What was built

All prototype code lives in `spikes/stroke-matching/` (not an npm workspace: it has its own `package.json`, like the other spikes; run `npm install` and `npm test` inside the folder). Nothing in `packages/` or `apps/` changed.

| Path                                                                 | What it is                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `spikes/stroke-matching/src/matcher.ts`                              | The matcher: `compareStroke` (one drawn stroke against one expected stroke) and `judgeStroke` (an attempt at stroke _i_ of a character, with reasons `reversed`, `wrong-order`, `too-short`, `off-start`, `off-end`, `wrong-direction`, `wrong-shape`) |
| `spikes/stroke-matching/src/geometry.ts`, `svgPath.ts`, `kanjivg.ts` | Resampling, an SVG path flattener for KanjiVG paths, and a KanjiVG SVG stroke extractor. Pure TypeScript, no Node or browser APIs, so they could move to `packages/lang-ja` or `packages/core`                                                         |
| `spikes/stroke-matching/src/hanziWriterData.ts`                      | Converts KanjiVG centrelines to Hanzi Writer character data (ribbon outlines and medians in its 1024 y-up space)                                                                                                                                       |
| `spikes/stroke-matching/src/synth.ts`                                | Seeded generator of synthetic good, sloppy, bad and borderline attempts                                                                                                                                                                                |
| `spikes/stroke-matching/src/matcher.test.ts`                         | Jest tests, including a regression guard: at the default tolerances at least 99% of good fixtures are accepted and at most 1% of bad fixtures                                                                                                          |
| `spikes/stroke-matching/data/kanjivg-strokes.json`                   | Stroke paths for the 20 characters, extracted unchanged from KanjiVG                                                                                                                                                                                   |
| `spikes/stroke-matching/fixtures/synthetic-*.json`                   | 1,590 synthetic attempts, one file per character                                                                                                                                                                                                       |
| `spikes/stroke-matching/results/synthetic-results.md`                | Full evaluation tables (generated)                                                                                                                                                                                                                     |
| `spikes/stroke-matching/page/template.html`                          | Source of the phone test page                                                                                                                                                                                                                          |
| `docs/spikes/stroke-test.html`                                       | The built, self-contained test page (open it directly; no server or network needed)                                                                                                                                                                    |

Scripts (run with `npm run <name>` inside `spikes/stroke-matching/` after `npm install` there): `data` (rebuild the stroke JSON from downloaded KanjiVG SVGs), `fixtures` (regenerate synthetic fixtures), `evaluate` (rewrite the results tables), `page` (rebuild the test page).

### Characters

Kanji: 一 二 三 人 口 日 月 山 川 水 (straight strokes, corner hooks in 口 日 月, sweeps in 人 水, a hooked first stroke in 水 and 川).
Kana: あ い う お か さ し の め ぬ (loops in あ お の め ぬ, hooks in か さ し, short dots in お か).

### How the matcher works

1. Drop repeated points and resample both the drawn and the expected stroke to N points evenly spaced along their length.
2. Reject strokes shorter than 0.3 of the expected length (taps).
3. Start distance and end distance: from the first and last drawn points to the expected ones, divided by canvas size.
4. Direction: angle between the drawn and expected start-to-end vectors. For strokes that nearly close on themselves (chord shorter than 0.3 of the length, for example の), the vector to the point a quarter of the way along is used instead, because the chord of a loop is unstable.
5. Average distance: mean distance between the _i_-th drawn and _i_-th expected resampled points, divided by canvas size. Because the points correspond by position along the stroke, this check also catches wrong shapes and reversed strokes.
6. `judgeStroke` then rejects an accepted stroke if a later stroke fits at least twice as well (wrong order), and labels a rejected stroke `reversed` if the reversed drawing would pass, or `wrong-order` if it matches a later stroke.

All distances are fractions of the canvas side, so the same tolerances hold for a 300 px phone canvas and a 440 px desktop canvas, and for KanjiVG's 109-unit space.

## Synthetic fixtures and results

Real recordings do not exist yet, so the fixtures are synthetic. They are generated from the KanjiVG strokes (seeded, reproducible) with three repeats per stroke per variant, 51 strokes in total:

| Group           | Variants                                                                                                                                                                                                                            | Expected verdict                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| good (765)      | neat; finger (offset up to 0.04, wobble 0.008 to 0.018, end trimmed or overshot up to 8%); whole character scaled 0.85 or 1.15; shifted 0.06; rotated ±7°                                                                           | accept                              |
| sloppy (153)    | scaled 0.78 to 1.22, rotated up to ±10°, offset up to 0.08, wobble 0.02 to 0.035, end trimmed or overshot up to 15%                                                                                                                 | accept (a forgiving matcher should) |
| bad (630)       | reversed; wrong order (the next stroke drawn instead); rotated 90° about its centre; misplaced by 0.3; for strongly curved strokes (corners, hooks, loops) a straight line between the ends, or the curve mirrored across its chord | reject                              |
| borderline (42) | gently curved strokes (sweeps, deviation 0.05 to 0.15 of canvas) drawn straight or bowed the other way                                                                                                                              | either; reported, not counted       |

Points are `[x, y, t]` in KanjiVG units (0 to 109) with `t` in ms, sampled like 60 Hz pointer events (denser at the ends of the stroke). The test page exports recordings in the same shape.

### Accept rates at several tolerance settings (N = 32)

False reject rate = 100% minus "good accepted". False accept rate = "bad accepted".

| Preset (start/end, average distance, direction) | Good accepted | Sloppy accepted | Bad accepted | Borderline accepted |
| ----------------------------------------------- | ------------- | --------------- | ------------ | ------------------- |
| strict (0.10, 0.07, 30°)                        | 86.8%         | 35.3%           | 0.0%         | 45.2%               |
| medium (0.15, 0.10, 45°)                        | 98.2%         | 68.6%           | 0.0%         | 88.1%               |
| **lenient (0.20, 0.13, 60°), recommended**      | **99.7%**     | **90.8%**       | **0.0%**     | 100.0%              |
| very lenient (0.25, 0.16, 75°)                  | 100.0%        | 97.4%           | 1.0%         | 100.0%              |

At "very lenient" the false accepts are all straightened curves (15.4% of that variant). Kana are a little harder than kanji at every setting (lenient: kanji 99.0% of good and sloppy accepted, kana 97.2%), because loops amplify small offsets in the average distance. The full tables, including a sweep of average distance against start/end distance and per-variant false-accept rates, are in `spikes/stroke-matching/results/synthetic-results.md`.

Other findings from the sweep:

- Average distance is the tolerance that matters most. Start/end distance above 0.15 barely changes the false-accept rate, and below 0.15 it rejects scaled and shifted characters.
- N = 16, 32 and 64 give the same results within 1%. 32 is plenty.
- Measuring average distance after aligning centroids (so only shape is compared) accepts more sloppy strokes but lets in 41% to 62% of straightened curves. Not recommended; the plain SDD design is better.
- Reversed and wrong-order strokes were never accepted at any setting, and `judgeStroke` labels them correctly, which is what the Product Spec's "shakes and is discarded" behaviour needs.

### Hanzi Writer on the same fixtures

Hanzi Writer 3.7.3 `strokeMatches`, run in Node on the same attempts with the same KanjiVG strokes, outline visible (its quiz default, equivalent to trace mode):

| Leniency    | Good accepted | Sloppy accepted | Bad accepted | Borderline accepted |
| ----------- | ------------- | --------------- | ------------ | ------------------- |
| 0.75        | 98.6%         | 86.9%           | 0.0%         | 47.6%               |
| 1 (default) | 100.0%        | 96.1%           | 0.0%         | 71.4%               |
| 1.5         | 100.0%        | 100.0%          | 18.9%        | 90.5%               |
| 2           | 100.0%        | 100.0%          | 26.5%        | 100.0%              |

Hanzi Writer's matcher has more checks (Fréchet shape fit with small rotations, length ratio, per-segment direction) and its average-distance threshold is halved when the outline is shown or after the first stroke, so it tolerates scale and rotation better while staying strict on shape. Leniency scales every threshold at once, so above 1 misplaced strokes start to pass (68% at 1.5).

### Caveats

- Synthetic noise is a model of a finger, not a finger. Real strokes have hooks at the end, lifts mid-stroke, and big offsets on small phones. The numbers above show the matcher is sound; they do not prove the tolerances are right for family members. That is what the owner test is for.
- The bad set is fairly easy (wrong strokes are clearly wrong). Subtle errors such as a hook in the wrong direction or a stroke that should be two strokes are not modelled.
- Borderline strokes show the tolerance's real trade-off: at the recommended setting a gentle sweep drawn as a straight line is accepted. This fits the Product Spec ("neatness does not count").

## Matcher versus Hanzi Writer

|                                | Manabi matcher (prototype)                                                                            | Hanzi Writer 3.7.3 with KanjiVG data                                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size                           | ~150 lines of TypeScript plus a 100-line path flattener                                               | 37 KB minified library                                                                                                                                                                          |
| Licence                        | Ours                                                                                                  | MIT. Its bundled character data (Make Me a Hanzi, Arphic Public License) is Chinese-only and is **not** used: Japanese needs KanjiVG anyway, so we would feed it our own data                   |
| Data                           | KanjiVG centrelines used directly                                                                     | Needs outlines and medians; KanjiVG has no outlines, so this spike draws fixed-width ribbons around the centrelines (`hanziWriterData.ts`). Looks less like a brush stroke than Make Me a Hanzi |
| Input                          | Pointer Events (mouse, touch, stylus; coalesced events)                                               | Mouse and touch events only, and a global `mouseup`/`touchend` listener on `document`; stylus works through touch emulation                                                                     |
| Accuracy on synthetic fixtures | 99.7% good, 90.8% sloppy, 0% bad (lenient)                                                            | 100% good, 96.1% sloppy, 0% bad (leniency 1)                                                                                                                                                    |
| Explaining a rejection         | Reason codes (reversed, wrong order, off start, wrong shape and so on)                                | Only "mistake" and a backwards flag                                                                                                                                                             |
| Fit with the architecture      | Pure TypeScript; runs in core or `packages/lang-ja`, on server and client, and in a future native app | DOM-bound (SVG or canvas renderer); the matcher is not exported, so it cannot be used without its renderer                                                                                      |
| Rendering, animation, hints    | We write them (the SDD already plans dash-offset animation of KanjiVG paths)                          | Built in: stroke animation, outline, hint after N misses                                                                                                                                        |
| Theming                        | Our Emotion theme                                                                                     | Hex colours passed as options                                                                                                                                                                   |

Original recommendation (superseded by the decision below): build our matcher for its reason codes and plugin-layer fit. The comparison above stays as the evidence.

## Decision

**Decided 2026-11-11 by the owner: adopt Hanzi Writer, not a custom matcher.**

Reasons:

1. FR-072 only requires judging order, direction and position within a configurable tolerance. It does not require reason codes, which was the main argument for building our own.
2. Hanzi Writer's shape-fit (Frechet) and length-ratio checks reject squiggly strokes that average out along a straight line. The owner found this problem with the prototype matcher, whose average-distance check accepts them.
3. It scored better on the fixtures: at leniency 1, 100% good, 96.1% sloppy, 0% bad (prototype: 99.7%, 90.8%, 0%).
4. It provides stroke animation (FR-071) and hint-after-misses (FR-073) out of the box.

Costs accepted:

- Outlines are generated as fixed-width ribbons around the KanjiVG centrelines (the `hanziWriterData.ts` approach), done at import time. They look less like brush strokes than Make Me a Hanzi data.
- Stylus input works through touch emulation, since Hanzi Writer uses mouse and touch events, not Pointer Events.
- Theming goes through colour options rather than the Emotion theme.
- The matcher is DOM-bound (not exported without its renderer), so it lives in the web app rather than `packages/lang-ja`.

Settled with it:

- **Trace mode and memory mode stay as the SRS describes** (FR-073): trace mode shows the guide; memory mode shows it after 2 failed attempts.
- **Leniency:** start at 1 (the default). Above 1, misplaced and straightened strokes start to pass (18.9% false accepts at 1.5).
- **Real recordings:** the owner's recordings are attached to issue #2 (`stroke-attempts-2026-11-11T15-54-23-737Z.json`). The implementation issue should convert them to fixtures and use them to confirm the leniency setting. They are deliberately not processed in this spike.
- Fallback from SDD section 14 (trace mode only in v1) is no longer needed.
- Not carried out here: the 60 fps phone check (NFR-05); do it in the implementation issue with the real component.

## Test page

`docs/spikes/stroke-test.html` is a single self-contained HTML file (inline CSS and JS, embedded stroke data, Hanzi Writer inlined; no external requests). It:

- Lets you draw each of the 20 characters with Pointer Events on a square canvas sized to the screen (works at 375 px phone width), with `touch-action: none` and non-passive touch handlers so the page does not scroll or zoom while drawing.
- Shows the verdict for each stroke with the measured start, end, average distance and direction values. Rejected strokes flash red and shake; accepted strokes ink in.
- Has trace mode (next stroke shown as a guide with a start dot) and memory mode (no guide; the guide shows after 2 failed attempts, per FR-073).
- Has sliders and presets for the tolerances and N, and a Hanzi Writer tab with a leniency slider, both quizzing the same characters with the same KanjiVG data.
- Measures, per stroke: raw `pointermove` events per second, coalesced samples per second, animation frames per second while drawing, and the longest gap between frames.
- Records every attempt (labelled good or bad by a toggle) in local storage, and exports them as JSON by download, copy, or a text box.

## Owner testing

Status: the owner has recorded real attempts (attached to issue #2). The checklist below was the original plan and is kept for reference; remaining items move to the implementation issue. Original wording: please send back the exported JSON files and the numbers; an agent can then convert them into `fixtures/recorded-*.json` and rerun the evaluation.

- [ ] Copy `docs/spikes/stroke-test.html` to the phone (or serve it from the home server) and open it in the phone's normal browser. It needs no network.
- [ ] Type the phone model and input into the device box (for example "Pixel 6a, finger").
- [ ] Confirm that drawing on the canvas never scrolls or zooms the page.
- [ ] With **Manabi matcher**, **Trace mode** and **Recording: good**: draw all 20 characters neatly once, then once quickly and carelessly the way a learner would.
- [ ] Switch to **Recording: bad** and draw some deliberate mistakes: strokes backwards, strokes out of order, wrong shapes (for example a straight line for the loop of の).
- [ ] Repeat the good set with a stylus and with a mouse if available (IF-11).
- [ ] Note the per-stroke numbers under the canvas: is it at or near **60 frames per second** with no frame gaps much over 17 ms (NFR-05)? Note the pointer events per second too.
- [ ] Try the **Lenient (recommended)** preset and say whether it feels fair: are neat strokes ever rejected, are bad ones ever accepted? Adjust the sliders until it feels right and write down the values.
- [ ] Try **Memory mode** on a few characters.
- [ ] Switch to **Hanzi Writer** and draw the same characters. Which feels better?
- [ ] Download or copy the JSON and attach it to issue #2.
- [ ] Decide build versus adopt (proposal: build our matcher), and whether v1 ships trace mode only.

Open results to fill in after the owner test:

| Question                                         | Answer                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Phone tested                                     | Not recorded in this spike; recordings attached to issue #2                                  |
| 60 fps tracking achieved (NFR-05)?               | Not recorded; check in the implementation issue                                              |
| False reject / false accept on recorded fixtures | Synthetic only here; recorded data to be processed in the implementation issue               |
| Tolerances agreed                                | Hanzi Writer leniency 1 to start; confirm against the recordings in the implementation issue |
| Build or adopt                                   | **Adopt Hanzi Writer** (decided 2026-11-11)                                                  |

## Licences and attribution

- Stroke data: [KanjiVG](https://kanjivg.tagaini.net), Copyright (C) 2009/2010/2011 Ulrich Apel, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The 20 SVG files were downloaded from the official repository, <https://github.com/KanjiVG/kanjivg> (`kanji/` folder, commit `610091ce618cf757ed1357a8954cd65283e015d6`). `data/kanjivg-strokes.json` holds the unchanged stroke paths; the fixtures and the Hanzi Writer outlines are adaptations and are shared under the same licence. Attribution also appears in the JSON file and on the test page.
- Hanzi Writer 3.7.3: MIT, Copyright (c) 2014 David Chanin. Installed from npm as a dev dependency of the spike and inlined into the test page with its licence header.
- Hanzi Writer's own character data comes from Make Me a Hanzi and Arphic fonts under the Arphic Public License. This spike does not use or redistribute that data.

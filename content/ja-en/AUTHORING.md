# Authoring the ja-en content pack

Placeholder. This document will describe:

- Data sources and their licences
- Pack structure, with worked examples (`course.yaml`, `units/`, `items/`, `grammar/`, `lists/`, `audio/`)
- Conventions (ids, naming, ordering, glosses)
- The procedure for adding a level
- The validation command

Importing a pack never writes to progress tables.

`lists/supplementary-words.yaml` holds common words the JLPT level lists lack (FR-234). They
count as level-list words, so after changing it import the pack, then re-run the JMdict and
Tatoeba imports to add their word items and the sentences they unblock.

## Authored exercises

A lesson in `units/<nn>-<slug>.yaml` lists its hand-written exercises under `exercises`, in the
order they are shown. Each has a `key` unique within the lesson, a `type` from the exercise
registry (`packages/core/src/exercises`) and a `payload` in that type's payload shape, with two
differences:

- Items are named by stable key, `item: <key>`, where the stored payload has `itemId`. A raw
  `itemId` is an error, since ids differ between databases.
- Answers in an `accept` list (`typed_answer`, `fill_blank`, `conjugate`) may leave out `tiles`: import
  segments the text. Once stored, those tiles are kept on re-import for as long as the text stays
  the same, so tiles edited after import are not overwritten. Every other answer text
  (`word_bank`, `reorder`) must have its tiles written, because `acceptedOrders` index them.
  Tiles written in the pack are stored as written.

```yaml
lessons:
  - key: ja-en:n5:ordering:words
    type: vocabulary
    title: Drinks
    items: [ja:word:水:みず]
    exercises:
      - key: build-water
        type: word_bank
        payload:
          prompt: Water
          answer:
            text: 水
            tiles: [{ surface: 水, base: 水, reading: みず, item: ja:word:水:みず }]
          distractors: [{ surface: 火, base: 火, reading: ひ }]
          acceptedOrders: [[0]]
      - key: type-water
        type: typed_answer
        payload:
          prompt: water
          answerLanguage: target
          accept: [{ text: 水 }]
```

Re-import updates an exercise in place by its key. An exercise removed from the pack is archived,
not deleted, and comes back if its key returns. Export writes every exercise with its tiles.
`npm run manabi -- pack lint content/ja-en` reports invalid payloads with file, line and path. It
also reports any item an exercise names (its tiles included) that is not taught in the same lesson
or an earlier one on the path (FR-048). Path order is the sections in `course.yaml`, then the unit
files within each section, then lessons, and an earlier lesson counts only once it and its unit are
published. Any word from `lists/blocked-words.yaml` in an exercise's tiles or text (prompts,
options, answer text) is reported too, with the text segmented as import does (FR-237).

## Recorded clips (`audio/`)

Words and sentences get a generated voice clip on first play. To use a recording instead (FR-132),
put the file in `audio/` and list it with its owner in `audio/clips.yaml`:

```yaml
- file: mizu.wav
  item: ja:word:水:みず # an item, by stable key
- file: tatoeba-4702.m4a
  sentence: { source: tatoeba, sourceId: '4702' } # an imported sentence
- file: mizu-desu.ogg
  sentence: { text: 水です。 } # an authored sentence, by its text
```

File names are plain names inside `audio/` (no folders) ending in `.opus`, `.ogg`, `.oga`, `.mp3`,
`.wav`, `.webm`, `.m4a` or `.flac`. Each recording is at most 5 MB and 30 seconds. Import checks
each file and transcodes it to the same mono Opus as generated clips, stored for the owner's
reading at import time; a clip whose owner is not in the course, a file that is missing or not
listed, or a file that is not audio stops the import. Import only adds and replaces recordings:
one an author uploaded on the server that the pack lacks is kept. Export writes every uploaded
recording back (as `item-<hash>.opus` and `sentence-<hash>.opus`) and never the generated clips.

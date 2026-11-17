# @manabi/importers

Parsers for the open datasets behind the content tables (SDD section 10). Parsing lives here;
the API's `imports` module validates the items, upserts them by stable key and records an
`import_runs` row with the counts, dataset version, licence and attribution. Imports never touch
progress tables or author overrides.

## Datasets

`datasets.ts` lists each dataset's download URLs, licence and attribution.

```sh
npm run download --workspace @manabi/importers
```

fetches them into the git-ignored `packages/importers/datasets/<name>/` (`.gz` files unzipped)
with a `manifest.json` holding the version and licence. Tests and CI never download; they use
the fixtures in `fixtures/`.

## Importers

- KANJIDIC2: `npm run manabi -- import kanjidic2 ja-en packages/importers/datasets/kanjidic2/kanjidic2.xml`,
  or the `import-kanjidic2` worker job with `{ courseKey, file }`. The course must exist first
  (`npm run manabi -- pack import content/ja-en`).
- JLPT level lists: `npm run manabi -- import level-lists ja-en`, or the `import-level-lists`
  worker job with `{ courseKey }`. Reads the committed copy in `data/tanos/` (never downloaded,
  FR-233) up to `LEVEL_CEILING` (default N3), sets `level_code` on imported kanji items and stores
  the words in `level_list_words`. Run it after KANJIDIC2; raise the ceiling and run it again to
  add a level.
- JMdict: `npm run manabi -- import jmdict ja-en packages/importers/datasets/jmdict/JMdict_e`, or
  the `import-jmdict` worker job with `{ courseKey, file }`. Imports one word item per level-list
  or supplementary word found (`ja:word:<written>:<reading>`) with its list level, and links it to
  its kanji items. Run it after the level lists; the run summary lists the words not found
  (`unmatched`) and keys an authored item or another course owns (`skippedOwned`).
- KanjiVG (CC BY-SA 3.0, Ulrich Apel and contributors): `npm run manabi -- import kanjivg ja-en packages/importers/datasets/kanjivg/kanjivg-20260714.xml`,
  or the `import-kanjivg` worker job with `{ courseKey, file }`. Creates the course's kana items
  (`ja:kana:<char>`, the 71 hiragana and 71 katakana in `@manabi/lang-ja`) if missing, then stores
  `stroke_data` for every item with a `character` (kana and kanji), converted to Hanzi Writer data:
  a fixed-width ribbon outline around each centreline plus its median (FR-077). The run summary
  lists characters without KanjiVG strokes in `missing`. Run it after KANJIDIC2.
- Not yet: Tatoeba.

## Sentence segmentation

`segmentText(plugin, text)` (FR-238) runs the plugin's declared analyzer adapter, then the
plugin's `segment`. The only adapter is `kuromoji-ipadic` (kuromoji 0.1.2, dictionary read from
`node_modules/kuromoji/dict`, so the API bundle keeps kuromoji external). Adapters hold no language
rules: lint rejects Japanese text in this package's source and kuromoji imports anywhere else.
Store only the Tile part of each result; `counted` is for the coverage check. The gold tests run
against `fixtures/word-boundaries/` (the spike's 100 gold sentences and 40 held-out ones).

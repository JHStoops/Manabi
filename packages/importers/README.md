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
- Not yet: JMdict, KanjiVG, Tatoeba, JLPT level lists (read from a committed copy, never downloaded).

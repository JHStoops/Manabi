# Spike: word boundaries for Japanese sentences

Issue #4. Requirement ids: FR-240 (tokenizing goes through the language plugin), FR-093 (tap a word in a sentence for its card), FR-222 (marked-up grammar examples). Design: SDD section 4 (`tokenize`) and section 14 (Word boundaries).

**Question.** Is a morphological analyzer good enough to pre-tokenize imported Tatoeba sentences into tappable words and word-bank tiles, so authors only review them? Authored boundaries always win; this only seeds them.

**Answer.** Yes. kuromoji.js plus about ten merge rules got 95 of 100 sample sentences exactly right (99.2% boundary F1) and 35 of 40 held-out sentences. The analyzer is too large for the browser and needs file or network access to load its dictionary, so it must run only at import time in Node. Tiles are stored with the sentence, and the `lang-ja` plugin reads stored boundaries instead of analyzing text.

## Method

- **Data.** Tatoeba Japanese sentence export (`jpn_sentences.tsv`, 248,970 sentences, downloaded 2026-11-11 to `~/.cache/manabi-spikes/tatoeba-jpn/`, not committed). Licence CC BY 2.0 FR; sentence ids are kept so each one can be attributed.
- **Rough N5 filter.** 5 to 16 characters; only hiragana, katakana, `。、？！` and about 80 N5 kanji; at least one kanji; duplicates removed. 9,756 sentences passed.
- **Sample.** The candidates were shuffled with a fixed seed (mulberry32, seed 20261111). The first 100 are the sample (`spikes/word-boundaries/sample.json`). The next 40 are a held-out set (`holdout.json`) that was not looked at while the rules were written.
- **Tools.** kuromoji 0.1.2 (IPADIC dictionary, Apache-2.0) and TinySegmenter (`tiny-segmenter` 0.2.0, BSD, no dictionary and no part of speech). A Sudachi WASM port (`sudachi` on npm, last published 2021) was not tried, because kuromoji was already good enough and that package looks unmaintained.
- **Gold standard.** Every sentence was tiled by hand following the tile spec below (`gold.tsv`). Punctuation is not a tile and is ignored when scoring.
- **Scores.** "Exact" means every tile in the sentence matches. Boundary precision and recall count the internal split points.

The code is throwaway, in `spikes/word-boundaries/`. It has its own `package.json` and is not a workspace. To rerun it: `npm install` in that folder, then `node select.ts <jpn_sentences.tsv>`, `node tokenize.ts`, `node evaluate.ts`, and `node tokenize.ts holdout.json` followed by `node show-holdout.ts`.

## What a learner wants as a tile

| #   | Rule                                                                                                                                                                 | Examples                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| T1  | Each particle is its own tile, including stacked ones and sentence-final ones                                                                                        | `に は`, `より も`, `わ ね`, `か な`, `って`                                         |
| T2  | A verb is one tile with all its endings and auxiliaries: polite, past, negative, desire, potential, causative, volitional, conditional, the て form and contractions | `食べました`, `行きたい`, `食べたくない`, `行かせないで`, `来なければ`, `なっちゃう` |
| T3  | A て form plus a helper verb (いる/てる, くる, いく, しまう, みる, おく), plus なさい, すぎる and がる, is one tile                                                  | `生きています`, `行ってきました`, `見たがってる`, `読みなさい`                       |
| T4  | ください, ほしい, いい (in てもいい) and べき stay separate, because each is taught as its own grammar point                                                         | `入れて ください`, `読んで ほしい`, `かじって も いい`, `つぐんでいる べき だった`   |
| T5  | An inflected i-adjective is one tile                                                                                                                                 | `高くない`, `よかった`                                                               |
| T6  | The copula is separate from its noun or adjective, as one tile with its own endings                                                                                  | `学生 です`, `金曜日 だ`, `だった`, `だろう`, `でしょ`, `である`, `ではない`         |
| T7  | Nominalizer の/ん after a verb or adjective, followed by a copula, is one tile; otherwise の is a tile on its own                                                    | `来た のです か`, `聞こえない んです か`, `行きたい んなら`; `飲む の は`            |
| T8  | A number plus its counter is one tile, and noun suffixes join their noun                                                                                             | `三人`, `一年生`, `一週間後`, `中国語`, `父さん`                                     |
| T9  | A する verb is one tile together with its noun                                                                                                                       | `電話しました`, `アルバイトしたい`                                                   |
| T10 | The honorific prefix お/ご joins its noun                                                                                                                            | `お休み`                                                                             |
| T11 | One dictionary word is one tile, even when it contains a particle                                                                                                    | `女の子`, `何で`, `ごきげんよう`                                                     |

These choices can be argued (for example, keeping `ています` apart from the verb), but each one is a single switch in the rules.

## Results

### Sample (100 sentences)

| Method            | Sentences exactly right | Boundary precision | Boundary recall | Boundary F1 |
| ----------------- | ----------------------- | ------------------ | --------------- | ----------- |
| kuromoji raw      | 22 / 100                | 75.5%              | 99.3%           | 85.8%       |
| kuromoji + rules  | **95 / 100**            | 99.0%              | 99.3%           | **99.2%**   |
| TinySegmenter raw | 15 / 100                | 72.6%              | 94.2%           | 82.0%       |

Raw kuromoji almost never misses a boundary a learner wants (99.3% recall). Its errors are over-splits (`食べ ませ ん`, `電話 し まし た`), so the post-processing is almost entirely merging, and merging can be done reliably from kuromoji's part-of-speech tags. TinySegmenter misses boundaries as well as over-splitting (`日 曜日`, `本より`, `ゆっくりやり`), and it gives no part of speech, so it cannot be fixed with rules. TinySegmenter is ruled out.

Remaining failures after the rules:

| Id       | Got                      | Wanted                 | Cause                                   |
| -------- | ------------------------ | ---------------------- | --------------------------------------- |
| 195443   | `また 後で`              | `また 後 で`           | IPADIC has 後で as one adverb           |
| 216852   | `… 気がついた`           | `… 気 が ついた`       | IPADIC has 気がつく as one idiom entry  |
| 8569437  | `シングル バー に …`     | `シングルバー に …`    | Katakana compound split                 |
| 10952515 | `うわ あ …`              | `うわあ …`             | Interjection split                      |
| 12438555 | `分 を わきまえた ま え` | `分 を わきまえたまえ` | たまえ (rare, literary) read as fillers |

### Held-out (40 sentences, rules unchanged, hand-checked)

**35 / 40 exactly right.** The failures:

| Id       | Got                        | Wanted                 | Cause                                      |
| -------- | -------------------------- | ---------------------- | ------------------------------------------ |
| 156905   | `私 は 今本 を …`          | `私 は 今 本 を …`     | Analyzer error (今本 read as a name)       |
| 172936   | `パリ なら ば なあ`        | `パリ ならば なあ`     | Rule gap: ば after a copula should join it |
| 183263   | `気に入ってる`             | `気 に 入ってる`       | Idiom entry, same as 気がつく              |
| 11023078 | `かわい 子ぶり や が って` | `かわい子ぶりやがって` | Slang, not in IPADIC                       |
| 12307452 | `お前 ん ち`               | `お前 んち`            | Colloquial contraction                     |

The lower held-out score is expected: the rules were written while looking at the sample. Plan on roughly 85 to 90% of short N5 sentences being right without author changes, and on most of the rest needing a single merge or split.

## Post-processing rules

The implementation is `spikes/word-boundaries/rules.ts`, about 100 lines over kuromoji's IPADIC tags. Each tile has a kind (verb, adjective, noun, する-noun, number, prefix, copula, nominalizer, particle) that controls what can join it.

| Id           | Rule                                                                                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0           | Drop punctuation (記号); it also stops any merge across it                                                                                                                                                             |
| R1           | 接頭詞 (お, ご) joins the next word                                                                                                                                                                                    |
| R2           | Consecutive 名詞,数 (numerals) merge                                                                                                                                                                                   |
| R3           | 名詞,接尾 (counters, 語, さん, 年生, 後) joins a preceding number or noun                                                                                                                                              |
| R4           | 動詞 with base form する joins a preceding 名詞,サ変接続                                                                                                                                                               |
| R5           | 動詞,非自立 and 動詞,接尾 (いる, てる, くる, みる, なさい, すぎる, がる, せる), plus ちゃう/じゃう, join a preceding verb or adjective; ください/下さい always start a new tile; すぎる also joins a noun (年上すぎる) |
| R6           | 助動詞 other than the copula and べき (ます, た, ない, たい, う, ん, れる, なければ) joins the preceding verb, adjective or copula; 接続助詞 て, で, ば, たり, ながら, ちゃ join a preceding verb or adjective         |
| R7           | The copula (base だ or です) starts its own tile, and its endings join it (でし+た, だろ+う, で+ある). じゃ/では followed by ない or ある starts a copula tile, and the は in で+は+ない joins it                      |
| R8           | の/ん tagged 名詞,非自立 after a verb or adjective, with a copula next, starts a nominalizer tile, and the copula joins it (のです, んじゃない, んなら)                                                                |
| R9           | Every other particle is its own tile                                                                                                                                                                                   |
| R10 (to add) | ば after a copula joins it (ならば); found in the held-out set                                                                                                                                                         |

Not rules but author work:

- Split dictionary idioms (気がつく, 気に入る, 後で). A small "split" list in the importer (a surface form mapped to its tiles) would cover the frequent ones.
- Join katakana compounds and fix rare grammar, slang and analyzer misreads.

## Size and load time

Measured on the home dev machine with Node 24 and kuromoji 0.1.2.

|                        | kuromoji + IPADIC                                                | TinySegmenter                |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------- |
| Library code           | 308 kB (67 kB gzip)                                              | 21 kB (9 kB gzip)            |
| Dictionary on disk     | 17.8 MB (gzip files); 100 MB uncompressed                        | none (model inside the code) |
| Package on disk        | 23.5 MB                                                          | 76 kB                        |
| Dictionary load        | about 220 ms (0.3 s cold process)                                | none                         |
| Memory                 | about 80 MB heap after load; peak RSS about 430 MB while loading | negligible                   |
| Tokenize 100 sentences | 8 ms                                                             | 6 ms                         |

## Where it should run

**Only at import time, in Node (the importer CLI or the pg-boss worker). Not in the browser and not inside `packages/lang-ja`.**

- **Browser.** A learner's phone would download about 18 MB of dictionary and hold about 100 MB in memory just to split sentences that never change. That rules it out.
- **lang-ja plugin.** Plugins must be pure TypeScript with no Node or browser APIs. kuromoji loads its dictionary through `fs` and `zlib` in Node, or through XHR in a browser. Inlining 18 MB into the plugin would put it in the web bundle. So the analyzer cannot live in the plugin.
- **Importer or worker.** Tokenizing is a one-time step per sentence, and sentences are already imported in a background job (SDD section 10, step 5). Loading takes 0.2 s, and tokenizing a whole level takes seconds. The dependency belongs with the importers (for example `packages/importers`, which only Node uses), not in `apps/web` or `packages/core`.
- **Fallback.** The fallback stays as in SDD section 14: authors mark boundaries by hand in the sentence editor. If an analyzer result is wrong or missing, the sentence just shows the analyzer's tiles flagged "unreviewed" until an author fixes them.

## What this means for the design

1. **Tiles are precomputed and stored.** The importer writes tiles into `sentences.tokens` (JSONB, already in the SDD data model) and into `sentences.yaml` when a pack is exported. Tatoeba sentences stay flagged "unreviewed". Authored or reviewed boundaries are never overwritten on re-import, following the same rule as `items.overrides`.
2. **`LanguagePlugin.tokenize` changes meaning.** The plugin can no longer derive good Japanese boundaries from a bare string. Approved change (owner, 2026-11-11), to be made in a follow-up issue, since this spike does not edit the SDD or code: `tokenize` takes the stored sentence (text plus stored boundaries) and returns the stored tiles, with a simple fallback when none are stored (one tile per run of the same script, or spaces for languages that use them). The analyzer becomes an import-time, Node-only per-language step, for example a `segmentSentence(text)` registered per language code in `packages/importers` (Japanese: kuromoji plus these rules). Language-specific logic stays out of core, api and web (FR-240), and the browser still gets instant tiles.
3. **Store more per token.** kuromoji also gives each token's base form (食べました → 食べる) and a katakana reading. Storing both in `tokens` seeds the item link that tap-to-define needs (FR-093: look up the JMdict word by base form) and the furigana reading. It costs nothing extra at import.

## Recommendation

**Approved by the owner on 2026-11-11**, including the design change in "What this means for the design": tiles (plus base form and reading per token) are precomputed at import by kuromoji and the merge rules in `packages/importers` (Node only), stored with the sentence, and `LanguagePlugin.tokenize` reads the stored tiles with a simple fallback. Authored boundaries win. The SDD and code change in follow-up issues; this spike changes neither. The sentence kana readings that the TTS service speaks (spike #1) come from the per-token readings produced by this step.

- Adopt kuromoji 0.1.2 with IPADIC plus the R0 to R10 merge rules as an import-time pre-tokenizer for Japanese sentences, run only in the importer or worker.
- Store the tiles, base forms and readings in `sentences.tokens`, mark imported sentences "unreviewed", and let authored boundaries always win.
- Keep hand marking in the sentence editor as the fallback and the final say. Expect authors to touch about 1 in 8 N5 sentences, mostly to split idioms or join compounds.
- Make `LanguagePlugin.tokenize` a reader of stored boundaries (follow-up issue), and do not ship any analyzer to the browser.
- Risks: kuromoji and IPADIC are old (no releases since 2018, dictionary from 2007), so slang and new loanwords are weak. That is acceptable for N5 to N3 textbook-style sentences. If accuracy drops at higher levels, try a Sudachi build behind the same importer interface. Nothing outside the importer would change.

# Spike: Tatoeba sentence yield and quality

Issue #3. Requirements: SRS FR-226 (import Tatoeba and level lists), NFR-62 (store and show attribution and licence); SDD section 10 step 5 and section 14 (Sentence quality).

Date: 2026-11-11. Script and small outputs: [`spikes/sentence-yield/`](../../spikes/sentence-yield/). Raw data stays in `~/.cache/manabi-spikes/` and is not committed.

## Answer

Yield is high. Tatoeba alone covers the N5 vocabulary: under the recommended filter, 14,583 N5 sentences survive and 95% of N5 words get at least one sentence (82% get five or more). Most surviving sentences are usable as they are (41 of 50 in the rated sample). The main problems are loose English translations and grammar above the level, not word choice. So the import is worth doing, but every imported sentence still needs the "unreviewed" flag and an author pass before learners see it. The fallback (hand-curate fewer sentences per item) is not needed for N5; it may be needed for the N4 words that get fewer than three sentences (see the counts).

## Data

| Source                                                                       | Version used                                                                    | Notes                                                                                                                                                                   |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tatoeba per-language exports (`downloads.tatoeba.org/exports/per_language/`) | Weekly export downloaded 2026-11-11                                             | `jpn_sentences_detailed.tsv` (248,970 Japanese sentences), `eng_sentences_detailed.tsv`, `jpn-eng_links.tsv`, plus `user_languages.csv` for the "native speaker" signal |
| JLPT Resources N5 and N4 vocabulary (tanos.co.uk, Jonathan Waller)           | Wayback Machine snapshot of 2020-07-28 (pages say "Updated: November 21, 2010") | 669 N5 rows and 582 N4 rows. **tanos.co.uk did not resolve in DNS on 2026-11-11**; see "Owner decisions"                                                                |

Pipeline: 248,970 Japanese sentences; 232,828 have at least one direct English translation; 1,081 are dropped for containing Latin letters; 231,747 are analysed. There are no exact duplicate Japanese texts. When a sentence has several English translations the lowest id is used.

## Method

1. **Segmentation.** kuromoji 0.1.2 (IPADIC) gives each token's dictionary form (lemma) and part of speech.
2. **Content words.** Particles, auxiliaries, punctuation, prefixes (お, ご), numbers, counters, non-independent nouns (こと, の), dependent verbs and adjectives (ている, てしまう, てほしい) and person or place names are treated as grammar, not vocabulary. Everything else must match a list word. A short whitelist covers words the lists leave out because they are grammar: ない, and the suffixes たち, ら, 中, 方, 屋, 語, ごろ, ぐらい.
3. **Matching.** A token matches a list entry when its lemma equals the entry's kanji or kana form (after splitting variants such as `いい/よい` and stripping `する`, `な`, `に` and a leading `お`/`ご` from list forms). If the lemma is written in kanji but the list has only a kana form, the lemma's reading is compared instead. Adverbs such as 本当に are retried without the trailing に.
4. **Level.** A sentence is N5 if all its content words are N5, and "N4 cumulative" if all are N5 or N4.
5. **Length.** Characters excluding spaces and punctuation (。、！？「」…). Limits tried: 10, 15, 20, and none.
6. **Native filter.** Optionally keep only sentences whose Japanese owner declares Japanese at level 5 (native) on their Tatoeba profile. This also drops the ownerless ("orphan") sentences.
7. **Per-word counts.** A list word is credited when a surviving sentence contains it. Compounds the tokenizer splits (映画館) and number words are credited by substring or by the number token, without being required.

### Limits of this method

- **Grammar is not checked.** Word coverage says nothing about grammar level: 6 of the 23 N5-labelled sentences in the sample use N4 or higher grammar (させてもらう, はず, てほしい, ておく). The importer should flag these for the author rather than trust the level.
- **Homographs are credited twice.** いる (居る and 要る) and 私 (わたし and わたくし) both get the same sentences, so a few per-word counts are inflated.
- **Suffixes and compounds leak.** Tokens tagged as counters or name suffixes are skipped, so a few unknown words pass (for example マイル as a counter).
- **The tanos lists have gaps and errors.** Very common words are missing from both lists: 父, 母, 彼ら, どんな, 心配, 幸せ, 出発, 終わる, ありがとう (the most frequent single missing words, each blocking 100 to 400 short sentences; full list in `output/summary.json`, `topNearMissLemmas`). There is at least one typo (明い for 明るい). Counts would rise if the course adds these words.
- **Proper names are allowed.** About 18% of N5 survivors contain a person or place name (mostly トム).
- **The quality rating is one rater (an AI) on 50 sentences.** It is a first pass for the owner to check, not a measurement.

## Survivor counts

Sentences that survive, and how many list words get at least 1, 3 or 5 surviving sentences. N4 counts are cumulative (sentences using only N5 and N4 words); the word columns for N4 count the 582 N4 words.

### All owners

| Level                     | Length limit | Sentences | Words with ≥1 | Words with ≥3 | Words with ≥5 |
| ------------------------- | ------------ | --------- | ------------- | ------------- | ------------- |
| N5 (669 words)            | ≤10          | 9,650     | 606 (90.6%)   | 529 (79.1%)   | 495 (74.0%)   |
| N5                        | ≤15          | 20,379    | 645 (96.4%)   | 609 (91.0%)   | 582 (87.0%)   |
| N5                        | ≤20          | 25,122    | 652 (97.5%)   | 618 (92.4%)   | 597 (89.2%)   |
| N5                        | none         | 26,593    | 652 (97.5%)   | 623 (93.1%)   | 605 (90.4%)   |
| N4 cumulative (582 words) | ≤10          | 16,295    | 492 (84.5%)   | 401 (68.9%)   | 314 (54.0%)   |
| N4 cumulative             | ≤15          | 38,638    | 541 (93.0%)   | 492 (84.5%)   | 449 (77.1%)   |
| N4 cumulative             | ≤20          | 50,501    | 548 (94.2%)   | 513 (88.1%)   | 478 (82.1%)   |
| N4 cumulative             | none         | 55,379    | 551 (94.7%)   | 518 (89.0%)   | 487 (83.7%)   |

### Native-speaker owners only

| Level         | Length limit | Sentences  | Words with ≥1   | Words with ≥3   | Words with ≥5   |
| ------------- | ------------ | ---------- | --------------- | --------------- | --------------- |
| N5            | ≤10          | 7,370      | 587 (87.7%)     | 509 (76.1%)     | 454 (67.9%)     |
| N5            | ≤15          | **14,583** | **636 (95.1%)** | **590 (88.2%)** | **547 (81.8%)** |
| N5            | ≤20          | 17,264     | 641 (95.8%)     | 598 (89.4%)     | 561 (83.9%)     |
| N4 cumulative | ≤10          | 12,081     | 460 (79.0%)     | 335 (57.6%)     | 257 (44.2%)     |
| N4 cumulative | ≤15          | **25,403** | **517 (88.8%)** | **443 (76.1%)** | **386 (66.3%)** |
| N4 cumulative | ≤20          | 30,975     | 527 (90.5%)     | 460 (79.0%)     | 413 (71.0%)     |

Sentences new at N4 (N4 cumulative minus N5) under the recommended filter: 25,403 − 14,583 = 10,820.

The N5 words with no sentence (24 with all owners, 33 with the native filter) are mostly counters and dates (五つ, 九日, 四日), compounds the tokenizer splits into an unknown part (誕生日, 郵便局, 灰皿), dated loanwords (テープレコーダー, ラジカセ, フィルム) and list errors (明い). Per-word counts are in `output/per-word.csv`.

## Rated sample

50 sentences drawn with a fixed seed (mulberry32, seed 3) from the N4-cumulative, length ≤15 survivors (all owners, so that the effect of the native filter can be seen). 23 are N5 and 27 are N4.

**First pass by the agent; the owner should check these ratings.** Scale: **Nat** (naturalness of the Japanese) 3 = natural, 2 = understandable but stiff, odd or context-dependent, 1 = unnatural or wrong. **Tr** (English translation) 3 = correct, 2 = loose or loses meaning, 1 = wrong.

| #   | Tatoeba id                                                 | Lvl | Len | Japanese                         | English                                        | JA owner            | Nat | Tr  | Note                                                                           |
| --- | ---------------------------------------------------------- | --- | --- | -------------------------------- | ---------------------------------------------- | ------------------- | --- | --- | ------------------------------------------------------------------------------ |
| 1   | [9081052](https://tatoeba.org/en/sentences/show/9081052)   | N4  | 10  | お茶を下げてください。           | Please clear away the tea things.              | small_snow (native) | 3   | 3   | 下げる here means "clear away", a sense beyond the list gloss "to lower"       |
| 2   | [87999](https://tatoeba.org/en/sentences/show/87999)       | N4  | 11  | 彼女は大変驚いたらしい。         | She seemed to be very surprised.               | (orphan)            | 3   | 3   |                                                                                |
| 3   | [235206](https://tatoeba.org/en/sentences/show/235206)     | N5  | 12  | ４時に帰らせてもらいます。       | I am leaving at four.                          | e4zh1nmcz (native)  | 3   | 2   | English drops the させてもらう nuance ("if you will let me"); grammar above N5 |
| 4   | [102738](https://tatoeba.org/en/sentences/show/102738)     | N4  | 13  | 彼は息子に会いたがっていた。     | He was in a hurry to see his son.              | (orphan)            | 3   | 1   | Wrong: たがる means "wanted to", not "was in a hurry"                          |
| 5   | [9828423](https://tatoeba.org/en/sentences/show/9828423)   | N5  | 12  | それが本当だとしましょう。       | Let's say that it's true.                      | small_snow (native) | 3   | 3   | とする grammar above N5                                                        |
| 6   | [873987](https://tatoeba.org/en/sentences/show/873987)     | N4  | 14  | 怖いからそんなことを言うのか？   | Do you say that because you're afraid?         | thyc244             | 3   | 3   | Blunt, masculine tone                                                          |
| 7   | [997361](https://tatoeba.org/en/sentences/show/997361)     | N5  | 9   | はい、あなたの本です。           | Here is your book.                             | mookeee             | 3   | 3   |                                                                                |
| 8   | [143813](https://tatoeba.org/en/sentences/show/143813)     | N5  | 5   | 水が欲しい。                     | I want some water.                             | mookeee             | 3   | 3   |                                                                                |
| 9   | [171673](https://tatoeba.org/en/sentences/show/171673)     | N5  | 13  | 今日は学校のはずではないの。     | Aren't you supposed to be at school today?     | (orphan)            | 2   | 3   | Stiff; a speaker would say 学校じゃないの. はず above N5                       |
| 10  | [2465713](https://tatoeba.org/en/sentences/show/2465713)   | N4  | 8   | 僕の時計知らない？               | Do you know where my watch is?                 | tommy_san (native)  | 3   | 3   |                                                                                |
| 11  | [154939](https://tatoeba.org/en/sentences/show/154939)     | N5  | 14  | 私は店の前でトムに会いました。   | I met Tom in front of the store.               | bunbuku (native)    | 3   | 3   |                                                                                |
| 12  | [105863](https://tatoeba.org/en/sentences/show/105863)     | N4  | 9   | 彼は私の兄の友達だ。             | He's a friend of my brother's.                 | bunbuku (native)    | 3   | 3   |                                                                                |
| 13  | [9007673](https://tatoeba.org/en/sentences/show/9007673)   | N4  | 8   | 午後って空いてる？               | Are you free in the afternoon?                 | bunbuku (native)    | 3   | 3   |                                                                                |
| 14  | [757782](https://tatoeba.org/en/sentences/show/757782)     | N5  | 8   | これは私の猫です。               | This is my cat.                                | arihato (native)    | 3   | 3   |                                                                                |
| 15  | [10154219](https://tatoeba.org/en/sentences/show/10154219) | N5  | 9   | 何かして欲しかった？             | Did you want me to do something for you?       | small_snow (native) | 3   | 3   | てほしい grammar is N4                                                         |
| 16  | [11052190](https://tatoeba.org/en/sentences/show/11052190) | N5  | 13  | そこに椅子を置くんじゃない。     | Don't put the chair there.                     | small_snow (native) | 3   | 3   | Prohibitive んじゃない is easy to misread; above N5                            |
| 17  | [192588](https://tatoeba.org/en/sentences/show/192588)     | N5  | 9   | ラジオを消しなさい。             | Shut off the radio.                            | bunbuku (native)    | 3   | 3   |                                                                                |
| 18  | [8772435](https://tatoeba.org/en/sentences/show/8772435)   | N4  | 7   | 誰か探してるの？                 | Are you looking for somebody?                  | bunbuku (native)    | 3   | 3   |                                                                                |
| 19  | [178642](https://tatoeba.org/en/sentences/show/178642)     | N4  | 10  | 君にまたお会いしたい。           | I want to see you again.                       | (orphan)            | 2   | 3   | Register clash: casual 君 with humble お会いしたい                             |
| 20  | [8689008](https://tatoeba.org/en/sentences/show/8689008)   | N5  | 10  | トムって結婚してるの？           | Is Tom married?                                | small_snow (native) | 3   | 3   |                                                                                |
| 21  | [1835990](https://tatoeba.org/en/sentences/show/1835990)   | N4  | 12  | 彼は本を机に置いていった。       | He put the book on the desk.                   | small_snow (native) | 3   | 2   | ていった: he put it there and left; English loses that                         |
| 22  | [10632843](https://tatoeba.org/en/sentences/show/10632843) | N4  | 12  | 電車に間に合わなくなるよ。       | You will not be able to catch the train.       | bunbuku (native)    | 3   | 3   |                                                                                |
| 23  | [2207290](https://tatoeba.org/en/sentences/show/2207290)   | N4  | 12  | 彼女は話をするのをやめた。       | She stopped talking.                           | bunbuku (native)    | 3   | 3   |                                                                                |
| 24  | [79228](https://tatoeba.org/en/sentences/show/79228)       | N4  | 15  | 由美はテニスをするのが上手です。 | Yumi is good at playing tennis.                | KK_kaku_ (native)   | 3   | 3   |                                                                                |
| 25  | [11040345](https://tatoeba.org/en/sentences/show/11040345) | N4  | 4   | 安心して。                       | Set your mind at ease.                         | small_snow (native) | 3   | 3   |                                                                                |
| 26  | [188082](https://tatoeba.org/en/sentences/show/188082)     | N4  | 12  | 何かプレゼントをあげるね。       | I'll give you a present.                       | bunbuku (native)    | 3   | 3   |                                                                                |
| 27  | [11797166](https://tatoeba.org/en/sentences/show/11797166) | N4  | 8   | 悪く思わないでね。               | Don't take it personally.                      | bunbuku (native)    | 3   | 3   |                                                                                |
| 28  | [9943123](https://tatoeba.org/en/sentences/show/9943123)   | N5  | 10  | トムは猫が欲しいんだ。           | Tom wants a cat.                               | small_snow (native) | 3   | 3   |                                                                                |
| 29  | [224934](https://tatoeba.org/en/sentences/show/224934)     | N5  | 8   | コーヒーください。               | I'd like to have a coffee.                     | bunbuku (native)    | 3   | 3   |                                                                                |
| 30  | [9026083](https://tatoeba.org/en/sentences/show/9026083)   | N5  | 4   | 忘れたの？                       | Did you forget?                                | small_snow (native) | 3   | 3   |                                                                                |
| 31  | [140657](https://tatoeba.org/en/sentences/show/140657)     | N4  | 12  | 祖母は田舎に住んでいます。       | My grandmother lives in the country.           | bunbuku (native)    | 3   | 3   |                                                                                |
| 32  | [205559](https://tatoeba.org/en/sentences/show/205559)     | N4  | 11  | それはあまりにも悲しい。         | That's really sad.                             | bunbuku (native)    | 3   | 2   | あまりにも is "too / so very"; "really sad" is loose                           |
| 33  | [9119469](https://tatoeba.org/en/sentences/show/9119469)   | N5  | 14  | トムは子供が大っ嫌いなんだよ。   | Tom hates children.                            | small_snow (native) | 3   | 3   | Colloquial 大っ嫌い                                                            |
| 34  | [4877](https://tatoeba.org/en/sentences/show/4877)         | N4  | 8   | 何をしてたと思う？               | What do you think I've been doing?             | bunbuku (native)    | 3   | 3   |                                                                                |
| 35  | [78170](https://tatoeba.org/en/sentences/show/78170)       | N5  | 6   | 旅行に行こう。                   | Let's take a trip.                             | mookeee             | 3   | 3   |                                                                                |
| 36  | [779731](https://tatoeba.org/en/sentences/show/779731)     | N5  | 15  | 私の友達は韓国語を勉強している。 | My friend studies Korean.                      | kenken              | 3   | 3   |                                                                                |
| 37  | [10918428](https://tatoeba.org/en/sentences/show/10918428) | N4  | 13  | かぜで熱が三十八度あります。     | I have a cold and a temperature of 38 degrees. | small_snow (native) | 3   | 3   |                                                                                |
| 38  | [3638421](https://tatoeba.org/en/sentences/show/3638421)   | N4  | 10  | 早くしないと遅れるよ。           | If we don't hurry, we'll be late.              | tommy_san (native)  | 3   | 3   |                                                                                |
| 39  | [8731289](https://tatoeba.org/en/sentences/show/8731289)   | N5  | 9   | トムはまだ病気なの？             | Is Tom still sick?                             | bunbuku (native)    | 3   | 3   |                                                                                |
| 40  | [10097816](https://tatoeba.org/en/sentences/show/10097816) | N5  | 13  | 鉛筆、数本しか持ってないのよ。   | I only have a few pencils.                     | small_snow (native) | 3   | 3   |                                                                                |
| 41  | [3421841](https://tatoeba.org/en/sentences/show/3421841)   | N5  | 10  | 私はロシアで生まれた。           | I was born in Russia.                          | konrad509           | 3   | 3   |                                                                                |
| 42  | [3367124](https://tatoeba.org/en/sentences/show/3367124)   | N4  | 9   | なんかおかしくない？             | Something's wrong, isn't it?                   | arnab (native)      | 3   | 3   |                                                                                |
| 43  | [101265](https://tatoeba.org/en/sentences/show/101265)     | N4  | 9   | 彼は売ると約束した。             | He promised to sell.                           | (orphan)            | 2   | 3   | Odd without an object or context                                               |
| 44  | [207152](https://tatoeba.org/en/sentences/show/207152)     | N4  | 14  | この番号で合っているはずです。   | I'm sure I have the right number.              | tommy_san (native)  | 3   | 3   |                                                                                |
| 45  | [2060571](https://tatoeba.org/en/sentences/show/2060571)   | N4  | 5   | 手伝わせて。                     | Let me help.                                   | bunbuku (native)    | 3   | 3   |                                                                                |
| 46  | [10683442](https://tatoeba.org/en/sentences/show/10683442) | N4  | 9   | 女性がいいんでしょ？             | You like girls, don't you?                     | small_snow (native) | 2   | 2   | Needs context; 女性 is "women", not "girls"; may not suit a family app         |
| 47  | [222833](https://tatoeba.org/en/sentences/show/222833)     | N5  | 15  | この家はこのままにしておきたい。 | I like this house as it is.                    | bunbuku (native)    | 3   | 2   | Means "I want to keep this house as it is", not "I like"; ておく is N4         |
| 48  | [370955](https://tatoeba.org/en/sentences/show/370955)     | N5  | 3   | 何これ？                         | What is this?                                  | saeb                | 3   | 3   |                                                                                |
| 49  | [1147846](https://tatoeba.org/en/sentences/show/1147846)   | N4  | 14  | 僕はまだ二十歳になっていない。   | I'm not twenty years old yet.                  | mookeee             | 3   | 3   |                                                                                |
| 50  | [2976160](https://tatoeba.org/en/sentences/show/2976160)   | N5  | 9   | 緑のシャツ、持ってる。           | I have a green shirt.                          | Fukuko              | 3   | 3   |                                                                                |

### Summary

| Measure                                     | Result                    |
| ------------------------------------------- | ------------------------- |
| Natural and correctly translated (3/3)      | 41 of 50 (82%)            |
| Japanese naturalness 3 / 2 / 1              | 46 / 4 / 0                |
| Translation 3 / 2 / 1                       | 44 / 5 / 1                |
| Fixable by editing the English only         | 5 (#3, #4, #21, #32, #47) |
| Better dropped or reworded                  | 4 (#9, #19, #43, #46)     |
| N5-labelled sentences with grammar above N5 | 6 of 23                   |

By owner: 4 of the 5 orphan (ownerless) sentences had a problem, against 5 of 36 from native-speaker owners and 0 of 9 from other owners. The Japanese of native-owned sentences was natural in 35 of 36; their problems were mostly in the English, which other people wrote. Orphan sentences are mostly from the old Tanaka Corpus, which is known to contain stiff or unchecked sentences; the native filter removes them.

## Recommended filter

For the importer (SDD section 10 step 5):

1. Japanese sentence has at least one direct English translation; use the lowest-id translation and keep the others' ids for the author to choose from.
2. No Latin letters in the Japanese.
3. Every content word is at or below the item's level (the coverage rule above), with grammar tokens, counters, numbers and person and place names exempt.
4. **Length ≤ 15** characters, excluding spaces and punctuation. ≤10 loses about a quarter of N5 words with five or more sentences; ≤20 adds little coverage and the extra sentences are the longest and hardest.
5. **Owner declares native Japanese** on Tatoeba (`user_languages`, level 5). This drops orphan sentences, which failed most often, and still leaves 14,583 N5 sentences. If coverage for a particular word is too thin, fall back to all owners for that word.
6. Import everything as "unreviewed". Authors pick at most a few sentences per item; the rest stay unpublished.
7. Store the kuromoji tokenization with each sentence so authors can see which words it uses and the coverage check can be re-run when the course word list changes.

Expected yield under this filter: about 14,600 N5 sentences covering 95% of N5 words (82% with five or more), and about 10,800 more at N4 covering 89% of N4 words (66% with five or more). The fallback (hand-curate fewer sentences per item) applies to the roughly 200 N4 words with fewer than five sentences and the 33 N5 words with none.

## Attribution requirements

### Tatoeba (CC BY 2.0 FR)

Tatoeba's terms of use say textual sentences are under CC BY 2.0 FR and reuse "is only allowed if the name of the author is cited"; the downloads page also notes some sentences are additionally CC0 and many Japanese and English sentences come from the public-domain Tanaka Corpus. CC BY 2.0 asks for the author's name, the licence (or a link to it) and the source URL where one is given. The Japanese sentence and its English translation are separate works, usually by different people, so each needs its own attribution.

Store per imported sentence (both the Japanese sentence and the chosen English translation):

| Field                    | Example                                         | Notes                                                                                     |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tatoeba sentence id      | `9081052`                                       | Stable key for idempotent re-import (FR-226)                                              |
| Owner username at import | `small_snow`                                    | `\N` in the export means no owner; store null and display "Tatoeba contributors"          |
| Source URL               | `https://tatoeba.org/en/sentences/show/9081052` | Derivable from the id, but storing it keeps attribution self-contained                    |
| Licence                  | `CC BY 2.0 FR`                                  | Per sentence, so a later CC0 or other licence can be recorded                             |
| Dataset version          | Export date, for example `2026-11-11`           | Also recorded on the `import_runs` row                                                    |
| Edited by Manabi         | boolean                                         | CC BY asks that changes be indicated; set it when an author edits the text or translation |

Display (NFR-62, FR-230): wherever an imported sentence is shown, a small "Tatoeba #9081052 by small_snow (CC BY 2.0 FR)" credit linking to the sentence page, with the translation's credit next to it; plus a Tatoeba entry on the About page with the licence link and dataset version. Sentences an author writes from scratch need no Tatoeba credit.

### tanos.co.uk level lists (CC BY, version unstated)

The site's "Use my data!" page (Wayback copy, updated 2011-10-12) says everything on the site not for sale is licensed under Creative Commons "BY", that it may be used commercially or not, and asks for credit to the site, preferably with a link. No licence version is given. Store "JLPT Resources by Jonathan Waller (tanos.co.uk), CC BY" with the snapshot date on the `import_runs` row and the About page; no per-word attribution is needed.

## Owner decisions

1. **tanos.co.uk is unreachable** (no DNS on 2026-11-11). The importer cannot download from it. Options: commit the N5 to N3 lists into the content pack as a parsed file (CC BY allows redistribution with credit), or download from the Wayback Machine snapshot. Committing a parsed copy is simpler and makes imports reproducible.
2. **Add common words the tanos lists lack** (父, 母, 彼ら, どんな, 心配, 幸せ, ありがとう …) to the course word list? They block hundreds of otherwise easy sentences and learners need them anyway.
3. **Native-owner filter**: keep it (recommended) or import all owners and rely on author review?
4. **Grammar level**: accept that imported sentences may use grammar above the item's level and leave it to author review, or add a grammar check later (it needs grammar points in the course first)?
5. **Content**: Tatoeba includes sentences about romance, drinking and violence. Author review is the only filter here; say if a word blocklist is wanted for a family audience.
6. **Check the 50 ratings above** (the issue's "owner has reviewed the rating" item).

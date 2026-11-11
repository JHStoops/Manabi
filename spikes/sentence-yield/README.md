# Spike: Tatoeba sentence yield (issue #3)

Throwaway analysis script. Not a workspace, not imported by app code. Results and conclusions are in
[`docs/spikes/sentence-quality.md`](../../docs/spikes/sentence-quality.md).

## Inputs (not committed)

Everything lives in `~/.cache/manabi-spikes/` (override with `MANABI_SPIKE_CACHE`):

```sh
C=~/.cache/manabi-spikes
mkdir -p $C/tatoeba $C/tanos $C/sentence-yield-deps
cd $C/tatoeba
B=https://downloads.tatoeba.org/exports
curl -O $B/per_language/jpn/jpn_sentences_detailed.tsv.bz2
curl -O $B/per_language/eng/eng_sentences_detailed.tsv.bz2
curl -O $B/per_language/jpn/jpn-eng_links.tsv.bz2
curl -O $B/user_languages.tar.bz2
bunzip2 -k *.tsv.bz2 && mkdir -p user_languages_x && tar -xjf user_languages.tar.bz2 -C user_languages_x
# tanos.co.uk did not resolve on 2026-11-11; the pages come from the Wayback Machine:
cd $C/tanos
W=http://web.archive.org/web/20200728231522id_/http://www.tanos.co.uk/jlpt
curl --compressed -o n5_vocab_wayback.html $W/jlpt5/vocab/
curl --compressed -o n4_vocab_wayback.html $W/jlpt4/vocab/
cd $C/sentence-yield-deps && npm init -y && npm install kuromoji@0.1.2
```

## Run

```sh
node spikes/sentence-yield/analyze.ts   # Node 24 strips the TypeScript types
```

Takes about 15 seconds. Writes `output/summary.json` (counts), `output/per-word.csv` (sentences per
list word at each length limit) and `output/sample.csv` (the 50-sentence rated sample, seed 3).

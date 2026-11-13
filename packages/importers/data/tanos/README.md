# JLPT level lists

JLPT Resources by Jonathan Waller (tanos.co.uk), CC BY. The site's "Use my data!" page licenses
everything on it not for sale under Creative Commons "BY" and asks for credit to the site,
preferably with a link: <http://www.tanos.co.uk/jlpt/>.

tanos.co.uk no longer resolves, so this is a parsed copy of its pages as archived by the Wayback
Machine (FR-233). The importer reads only these files and makes no network request. The pages
say "Updated: November 21, 2010", which is the `version` in `manifest.json`.

| File           | Wayback Machine snapshot                                                              | Entries |
| -------------- | ------------------------------------------------------------------------------------- | ------- |
| `N5-kanji.txt` | <https://web.archive.org/web/20200806005029/http://www.tanos.co.uk/jlpt/jlpt5/kanji/> | 79      |
| `N5-words.tsv` | <https://web.archive.org/web/20200728231522/http://www.tanos.co.uk/jlpt/jlpt5/vocab/> | 686     |
| `N4-kanji.txt` | <https://web.archive.org/web/20200716184232/http://www.tanos.co.uk/jlpt/jlpt4/kanji/> | 166     |
| `N4-words.tsv` | <https://web.archive.org/web/20200629172633/http://www.tanos.co.uk/jlpt/jlpt4/vocab/> | 585     |

Fetched 2026-11-12. The vocabulary pages have 669 (N5) and 582 (N4) rows; rows listing
alternatives give more than one entry here.

## Format

- `manifest.json`: version, licence and attribution (stored on every import run, NFR-62), and
  `levels` from easiest to hardest. The configured level ceiling must be one of them; levels
  after it are skipped. A level without files here is not committed yet.
- `<level>-kanji.txt`: one kanji per line, the Kanji column of the kanji page.
- `<level>-words.tsv`: `written<TAB>reading` per line, from the Kanji and Hiragana columns of
  the vocabulary page. A word with no kanji has its reading as its written form. A row listing
  alternatives (`川/河`, `きゅう / く`, `じゅう  とお`) became one line per written form and
  reading pair, without duplicates. The English column is not kept.

## Fixes to the source rows

| Level | Page row                       | Here                                             |
| ----- | ------------------------------ | ------------------------------------------------ |
| N5    | 明い あかるい                  | 明るい あかるい (typo)                           |
| N5    | 伯父/叔父 おじいさん           | お祖父さん/お爺さん おじいさん (wrong kanji)     |
| N5    | 伯父/叔父 おじさん             | 伯父さん/叔父さん おじさん (missing さん)        |
| N4    | 堅/硬/固い かたい              | 堅い/硬い/固い かたい (shorthand expanded)       |
| N4    | お・金持ち かねもち/おかねもち | 金持ち かねもち, お金持ち おかねもち (two words) |

## Adding a level

Save the level's kanji and vocabulary pages from the Wayback Machine, write the two files in the
format above, list the snapshots and any fixes here, then raise `LEVEL_CEILING` and run the
import again.

---
# Stub (SDD section 4): detected in imported sentences, page not written yet.
key: ja:grammar:to-suru
level: N3
pattern: Plain form + とする
# After だ or a verb only, so 友達とする ("do with a friend") is not matched.
detection:
  - [{ base: だ, pos: [助動詞] }, { base: と, pos: [助詞, 格助詞] }, { base: する }]
  - [{ pos: [動詞] }, { base: と, pos: [助詞, 格助詞] }, { base: する }]
---

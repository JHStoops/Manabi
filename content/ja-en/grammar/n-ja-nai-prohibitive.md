---
# Stub (SDD section 4): detected in imported sentences, page not written yet.
key: ja:grammar:n-ja-nai-prohibitive
level: N3
pattern: Verb-dictionary + んじゃない (prohibition)
# Only where a statement ends: 行くんじゃない？ and 行くんじゃないの？ are questions.
detection:
  - [
      { pos: [動詞] },
      { base: ん, pos: [名詞, 非自立] },
      { base: じゃ },
      { base: ない },
      { surface: 。 },
    ]
  - [
      { pos: [動詞] },
      { base: ん, pos: [名詞, 非自立] },
      { base: じゃ },
      { base: ない },
      { surface: ！ },
    ]
  - [
      { pos: [動詞] },
      { base: ん, pos: [名詞, 非自立] },
      { base: じゃ },
      { base: ない },
      { base: よ },
    ]
---

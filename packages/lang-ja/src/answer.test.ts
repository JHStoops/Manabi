import type { AnswerText, CheckResult, Exercise } from '@manabi/core';
import { checkAnswer, normalizeAnswer } from './answer';
import { romajiToHiragana } from './romaji';

// NFR-51: table-driven tests for the answer checking rules (Product Spec section 4, FR-143).

const t = (surface: string, reading = surface) => ({ surface, base: surface, reading });
const ja = (text: string, ...tiles: ReturnType<typeof t>[]): AnswerText => ({ text, tiles });
const en = (text: string): AnswerText => ({ text, tiles: [] });
const exercise = (accept: AnswerText[], testsKanji?: boolean): Exercise => ({
  type: 'typed_answer',
  payload: testsKanji === undefined ? { accept } : { accept, testsKanji },
});

const CORRECT: CheckResult = { result: 'correct' };
const WRONG: CheckResult = { result: 'wrong' };
const SPELLING: CheckResult = { result: 'near-miss', hint: 'Watch your spelling' };

const water = exercise([en('water')]);
const eat = exercise([en('to eat')]);
const apple = exercise([en('an apple'), en('apples')]);
const dont = exercise([en("I don't know")]);
const iceCream = exercise([en('ice cream')]);
const cat = exercise([en('cat')]);
const mizu = exercise([ja('水', t('水', 'みず'))]);
const mizuKanji = exercise([ja('水', t('水', 'みず'))], true);
const taberu = exercise([ja('食べる', t('食べる', 'たべる'))]);
const terebi = exercise([ja('テレビ', t('テレビ', 'てれび'))]);
const sentenceAccept = [
  ja('私は学生です。', t('私', 'わたし'), t('は'), t('学生', 'がくせい'), t('です')),
];
const sentence = exercise(sentenceAccept);
const hanaWo = exercise([ja('花を見る', t('花', 'はな'), t('を'), t('見る', 'みる'))]);
const gakkouHe = exercise([ja('学校へ行く', t('学校', 'がっこう'), t('へ'), t('行く', 'いく'))]);
const hana = exercise([ja('はな', t('はな'))]);
const konnichiwa = exercise([ja('こんにちは', t('こんにちは'))]);
const party = exercise([ja('パーティー', t('パーティー', 'ぱーてぃー'))]);
const kitte = exercise([ja('切手', t('切手', 'きって'))]);
const mixedAccept = [ja('日本', t('日本', 'にほん')), ja('にっぽん'), en('Japan')];
const mixed = exercise(mixedAccept);
const noTiles = exercise([ja('東京')]);

describe('checkAnswer', () => {
  it.each<[string, string, Exercise, CheckResult]>([
    // English: exact and normalized matches
    ['exact English', 'water', water, CORRECT],
    ['upper case', 'WATER', water, CORRECT],
    ['title case', 'Water', water, CORRECT],
    ['trailing punctuation', 'water!', water, CORRECT],
    ['surrounding spaces', '  water  ', water, CORRECT],
    ['full-width Latin', 'ｗａｔｅｒ', water, CORRECT],
    ['leading "the"', 'the water', water, CORRECT],
    ['leading "a"', 'a water', water, CORRECT],
    ['leading "to" dropped', 'eat', eat, CORRECT],
    ['leading "to" kept', 'to eat', eat, CORRECT],
    ['"to the" stacked', 'to the eat', eat, CORRECT],
    ['article dropped from the answer', 'apple', apple, CORRECT],
    ['different article', 'the apple', apple, CORRECT],
    ['second accept entry', 'apples', apple, CORRECT],
    ['apostrophe kept', "i don't know", dont, CORRECT],
    ['apostrophe dropped', 'I dont know', dont, CORRECT],
    ['curly apostrophe', 'I don’t know.', dont, CORRECT],
    ['extra inner spaces', "I  don't   know", dont, CORRECT],
    ['hyphen for a space', 'ice-cream', iceCream, CORRECT],
    // English: one-letter typos are near-misses
    ['substituted letter', 'watar', water, SPELLING],
    ['missing letter', 'wter', water, SPELLING],
    ['extra letter', 'waterr', water, SPELLING],
    ['swapped letters', 'wtaer', water, SPELLING],
    ['typo after normalizing', 'The Watr.', water, SPELLING],
    ['typo in a later accept entry', 'aples', apple, SPELLING],
    ['short-word swap after "to"', 'to eta', eat, WRONG],
    // English: wrong
    ['two typos', 'wtr', water, WRONG],
    ['two swaps', 'awtre', water, WRONG],
    ['another word', 'fire', water, WRONG],
    ['short word typo is another word', 'car', cat, WRONG],
    ['empty', '', water, WRONG],
    ['only punctuation', '?!', water, WRONG],
    ['only an article', 'the', water, WRONG],
    ['Japanese for an English answer', 'みず', water, WRONG],
    // Japanese: written form and kana spelling
    ['kanji as written', '水', mizu, CORRECT],
    ['kana spelling of a kanji word', 'みず', mizu, CORRECT],
    ['katakana spelling of a hiragana reading', 'ミズ', mizu, WRONG],
    ['okurigana word as written', '食べる', taberu, CORRECT],
    ['okurigana word in kana', 'たべる', taberu, CORRECT],
    ['wrong okurigana', '食る', taberu, WRONG],
    ['sentence as written', '私は学生です。', sentence, CORRECT],
    ['sentence without the full stop', '私は学生です', sentence, CORRECT],
    ['sentence in kana', 'わたしはがくせいです', sentence, CORRECT],
    ['sentence with spaces', 'わたし は がくせい です', sentence, CORRECT],
    ['sentence with a full-width space', '私は　学生です', sentence, CORRECT],
    ['sentence part kana, part kanji', 'わたしは学生です', sentence, CORRECT],
    ['sentence with a word left out', '私は学生', sentence, WRONG],
    ['kanji test: sentence part kana', 'わたしは学生です', exercise(sentenceAccept, true), WRONG],
    ['Japanese typo is not forgiven', 'みづ', mizu, WRONG],
    // Japanese: kanji-testing exercises
    ['kanji test: kanji', '水', mizuKanji, CORRECT],
    ['kanji test: kana refused', 'みず', mizuKanji, WRONG],
    ['kanji test: romaji refused', 'mizu', mizuKanji, WRONG],
    ['kanji test: explicit kana entry', 'にっぽん', exercise(mixedAccept, true), CORRECT],
    // Japanese: hiragana and katakana as written
    ['katakana as written', 'テレビ', terebi, CORRECT],
    ['katakana word in hiragana', 'てれび', terebi, WRONG],
    ['half-width katakana', 'ﾃﾚﾋﾞ', terebi, CORRECT],
    ['long vowel mark', 'パーティー', party, CORRECT],
    ['half-width long vowel mark', 'ﾊﾟｰﾃｨｰ', party, CORRECT],
    ['hiragana word in katakana', 'コンニチハ', konnichiwa, WRONG],
    // Japanese: romaji converted to kana
    ['romaji for a kanji word', 'mizu', mizu, CORRECT],
    ['upper-case romaji', 'MIZU', mizu, CORRECT],
    ['full-width romaji', 'ｍｉｚｕ', mizu, CORRECT],
    ['romaji for an okurigana word', 'taberu', taberu, CORRECT],
    ['romaji for a katakana word', 'terebi', terebi, CORRECT],
    ['romaji with a hyphen long vowel', 'pa-thi-', party, CORRECT],
    ['romaji with doubled consonant', 'kitte', kitte, CORRECT],
    ['romaji nn before a vowel', 'konnichiha', konnichiwa, CORRECT],
    ['romaji nnn (IME habit)', 'konnnichiha', konnichiwa, CORRECT],
    ['romaji wa in one word, not a particle', 'konnichiwa', konnichiwa, WRONG],
    ['romaji particle は as wa', 'watashi wa gakusei desu', sentence, CORRECT],
    ['romaji particle を as o', 'hana o miru', hanaWo, CORRECT],
    ['romaji particle を as wo', 'hana wo miru', hanaWo, CORRECT],
    ['romaji particle へ as e', 'gakkou e iku', gakkouHe, CORRECT],
    ['romaji particle へ as he', 'gakkou he iku', gakkouHe, CORRECT],
    ['kana わ for the particle は', 'わたしわがくせいです', sentence, WRONG],
    ['kana お for the particle を', '花お見る', hanaWo, WRONG],
    ['romaji wa for は inside a word', 'wana', hana, WRONG],
    [
      'kanji test: romaji particle',
      'watashi wa gakusei desu',
      exercise(sentenceAccept, true),
      WRONG,
    ],
    ['romaji sentence with spaces', 'watashi ha gakusei desu', sentence, CORRECT],
    ['romaji with a trailing full stop', 'mizu.', mizu, CORRECT],
    ['mixed kana and romaji', 'たべru', taberu, CORRECT],
    ['wrong romaji', 'mozu', mizu, WRONG],
    // Japanese: edge cases
    ['empty', '', mizu, WRONG],
    ['only spaces', '   ', mizu, WRONG],
    ['only Japanese punctuation', '。、', mizu, WRONG],
    ['entry with no tiles as written', '東京', noTiles, CORRECT],
    ['entry with no tiles has no kana form', 'とうきょう', noTiles, WRONG],
    ['empty answer and an entry with no tiles', '', noTiles, WRONG],
    // Mixed accept lists
    ['mixed: kanji', '日本', mixed, CORRECT],
    ['mixed: kana spelling', 'にほん', mixed, CORRECT],
    ['mixed: extra kana entry', 'にっぽん', mixed, CORRECT],
    ['mixed: romaji', 'nippon', mixed, CORRECT],
    ['mixed: English', 'japan', mixed, CORRECT],
    ['mixed: English typo', 'Japn', mixed, SPELLING],
  ])('%s: %j', (_name, given, ex, expected) => {
    expect(checkAnswer(given, ex)).toEqual(expected);
  });

  it('throws on a payload without an accept list', () => {
    expect(() => checkAnswer('water', { type: 'typed_answer', payload: {} })).toThrow();
  });
});

describe('normalizeAnswer', () => {
  it.each<[string, string, Exercise | undefined, string]>([
    ['English from the accept list', 'To the Water!', water, 'water'],
    ['Japanese from the accept list', 'ｍｉｚｕ。', mizu, 'みず'],
    ['katakana kept as written', 'テレビ', terebi, 'テレビ'],
    ['English guessed from the text', '  An  Apple. ', undefined, 'apple'],
    ['Japanese guessed from the text', '私は　学生です。', undefined, '私は学生です'],
    ['half-width katakana widened', 'ﾃﾚﾋﾞ', undefined, 'テレビ'],
  ])('%s', (_name, text, ex, expected) => {
    expect(normalizeAnswer(text, ex ? { exercise: ex } : {})).toBe(expected);
  });
});

describe('romajiToHiragana', () => {
  it.each<[string, string]>([
    ['aiueo', 'あいうえお'],
    ['shi chi tsu fu ji', 'し ち つ ふ じ'],
    ['si ti tu hu zi', 'し ち つ ふ じ'],
    ['kya shu cho nyo ryu', 'きゃ しゅ ちょ にょ りゅ'],
    ['ja jo zya', 'じゃ じょ じゃ'],
    ['wo', 'を'],
    ['kanji', 'かんじ'],
    ["hon'ya", 'ほんや'],
    ['honya', 'ほにゃ'],
    ['honn', 'ほん'],
    ['n', 'ん'],
    ['kitte', 'きって'],
    ['matcha', 'まっちゃ'],
    ['xtsu ltu xa la xyo', 'っ っ ぁ ぁ ょ'],
    ['fa vi dhi thi', 'ふぁ ゔぃ でぃ てぃ'],
    ['ra-men', 'らーめん'],
    ['q', 'q'],
  ])('%s', (romaji, kana) => {
    expect(romajiToHiragana(romaji)).toBe(kana);
  });
});

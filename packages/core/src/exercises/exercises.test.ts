import type { LanguagePlugin } from '../index';
import { CHOICE_TYPE, gradeResponse, MATCH_PAIRS_TYPE, WORD_BANK_TYPE } from '../index';

// FR-042: graders of EX-01 choice, EX-02 match pairs and EX-03 word bank. None reads the plugin.
const plugin = {} as LanguagePlugin;
const grade = (type: string, payload: unknown, ...attempts: unknown[]) =>
  gradeResponse({ type, payload }, { attempts }, plugin);

const choicePayload = {
  prompt: '水',
  options: [{ text: 'fire' }, { text: 'water', itemId: 7 }, { text: 'tree' }, { text: 'gold' }],
  correct: 1,
};

const matchPairsPayload = {
  pairs: [
    { term: 'あ', match: 'a' },
    { term: 'い', match: 'i' },
    { term: 'う', match: 'u' },
    { term: 'え', match: 'e' },
    { term: 'お', match: 'o', itemId: 3 },
  ],
};

const tile = (surface: string) => ({ surface, base: surface, reading: surface });
// 私は 学生 です; 学生 です 私は is also accepted.
const wordBankPayload = {
  prompt: 'I am a student',
  answer: { text: '私は学生です', tiles: [tile('私は'), tile('学生'), tile('です')] },
  distractors: [tile('先生'), tile('学生')],
  acceptedOrders: [
    [0, 1, 2],
    [1, 2, 0],
  ],
};

describe('EX-01 choice grader', () => {
  it('accepts only the correct option and shows it otherwise', () => {
    expect(grade(CHOICE_TYPE, choicePayload, 1)).toEqual({ result: 'correct' });
    expect(grade(CHOICE_TYPE, choicePayload, 0)).toEqual({ result: 'wrong', feedback: 'water' });
    expect(grade(CHOICE_TYPE, choicePayload, 2, 1)).toEqual({ result: 'correct' });
  });

  it('rejects malformed payloads and answers', () => {
    expect(() => grade(CHOICE_TYPE, choicePayload, 4)).toThrow();
    const three = { ...choicePayload, options: choicePayload.options.slice(0, 3) };
    expect(() => grade(CHOICE_TYPE, three, 0)).toThrow();
    const repeated = {
      ...choicePayload,
      options: [...choicePayload.options.slice(0, 3), { text: 'fire' }],
    };
    expect(() => grade(CHOICE_TYPE, repeated, 0)).toThrow('distinct');
  });
});

describe('EX-02 match pairs grader', () => {
  it('is correct only when every term is joined to its own match', () => {
    expect(grade(MATCH_PAIRS_TYPE, matchPairsPayload, [0, 1, 2, 3, 4])).toEqual({
      result: 'correct',
    });
    expect(grade(MATCH_PAIRS_TYPE, matchPairsPayload, [1, 0, 2, 3, 4])).toEqual({
      result: 'wrong',
    });
  });

  it('rejects malformed payloads and answers', () => {
    expect(() => grade(MATCH_PAIRS_TYPE, matchPairsPayload, [0, 1, 2, 3])).toThrow();
    const four = { pairs: matchPairsPayload.pairs.slice(0, 4) };
    expect(() => grade(MATCH_PAIRS_TYPE, four, [0, 1, 2, 3])).toThrow();
    const repeated = {
      pairs: [...matchPairsPayload.pairs.slice(0, 4), { term: 'か', match: 'a' }],
    };
    expect(() => grade(MATCH_PAIRS_TYPE, repeated, [0, 1, 2, 3, 4])).toThrow('distinct');
  });
});

describe('EX-03 word bank grader', () => {
  it('accepts each accepted order', () => {
    expect(grade(WORD_BANK_TYPE, wordBankPayload, [0, 1, 2])).toEqual({ result: 'correct' });
    expect(grade(WORD_BANK_TYPE, wordBankPayload, [1, 2, 0])).toEqual({ result: 'correct' });
  });

  it('treats a distractor with the same surface as the answer tile', () => {
    expect(grade(WORD_BANK_TYPE, wordBankPayload, [0, 4, 2])).toEqual({ result: 'correct' });
  });

  it('marks other orders, partial answers and invalid indexes wrong with the answer text', () => {
    const wrong = { result: 'wrong', feedback: '私は学生です' };
    for (const answer of [[1, 0, 2], [0, 1], [], [0, 3, 2], [0, 1, 2, 4], [0, 1, 9], [0, 0, 2]]) {
      expect(grade(WORD_BANK_TYPE, wordBankPayload, answer)).toEqual(wrong);
    }
  });

  it('rejects accepted orders that are not distinct answer tile indexes', () => {
    for (const acceptedOrders of [[], [[0, 0, 1]], [[0, 3]], [[]]]) {
      expect(() => grade(WORD_BANK_TYPE, { ...wordBankPayload, acceptedOrders }, [0])).toThrow();
    }
    const noTiles = { ...wordBankPayload, answer: { text: 'x', tiles: [] } };
    expect(() => grade(WORD_BANK_TYPE, noTiles, [0])).toThrow();
  });
});

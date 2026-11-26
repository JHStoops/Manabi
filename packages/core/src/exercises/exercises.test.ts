import type { LanguagePlugin } from '../index';
import {
  CHOICE_TYPE,
  CONJUGATE_TYPE,
  FILL_BLANK_TYPE,
  gradeResponse,
  MATCH_PAIRS_TYPE,
  READING_IN_CONTEXT_TYPE,
  REORDER_TYPE,
  STROKE_TRACE_TYPE,
  DRAW_MEMORY_TYPE,
  TYPED_ANSWER_TYPE,
  WORD_BANK_TYPE,
} from '../index';

// FR-042, FR-043: graders of EX-01 to EX-06, EX-09 and EX-10. Only typed ones read the plugin.
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

describe('EX-04 typed answer grader', () => {
  // A plugin that accepts the first entry exactly and calls anything else a near-miss or wrong.
  const checkAnswer = jest.fn((given: string, accept: readonly { text: string }[]) =>
    given === accept[0]!.text
      ? { result: 'correct' as const }
      : given === 'near'
        ? { result: 'near-miss' as const, hint: 'Watch your spelling' }
        : { result: 'wrong' as const },
  );
  const typedPlugin = { checkAnswer } as unknown as LanguagePlugin;
  const accept = [{ text: 'water', tiles: [] }];
  const payload = { prompt: '水', answerLanguage: 'base', accept };
  const typed = (p: object, ...attempts: unknown[]) =>
    gradeResponse({ type: TYPED_ANSWER_TYPE, payload: p }, { attempts }, typedPlugin);

  it('passes the plugin only the answer, accept list and testsKanji', () => {
    expect(typed(payload, 'water')).toEqual({ result: 'correct' });
    expect(checkAnswer).toHaveBeenLastCalledWith('water', accept, false);
    typed({ ...payload, testsKanji: true }, 'water');
    expect(checkAnswer).toHaveBeenLastCalledWith('water', accept, true);
  });

  it('keeps a near-miss hint and shows the first accepted answer when wrong', () => {
    expect(typed(payload, 'near')).toEqual({ result: 'near-miss', hint: 'Watch your spelling' });
    expect(typed(payload, 'fire')).toEqual({ result: 'wrong', feedback: 'water' });
  });

  it('rejects malformed payloads and answers', () => {
    expect(() => typed({ ...payload, accept: [] }, 'water')).toThrow();
    expect(() => typed({ ...payload, answerLanguage: 'ja' }, 'water')).toThrow();
    expect(() => typed(payload, 3)).toThrow();
  });
});

describe('EX-05 fill the blank grader', () => {
  const checkAnswer = jest.fn((given: string, accept: readonly { text: string }[]) =>
    accept.some((a) => a.text === given)
      ? { result: 'correct' as const }
      : { result: 'wrong' as const },
  );
  const blankPlugin = { checkAnswer } as unknown as LanguagePlugin;
  const accept = [
    { text: 'は', tiles: [tile('は')] },
    { text: 'が', tiles: [tile('が')] },
  ];
  const payload = { prompt: 'I am a student', before: '私', after: '学生です', accept };
  const blank = (p: object, ...attempts: unknown[]) =>
    gradeResponse({ type: FILL_BLANK_TYPE, payload: p }, { attempts }, blankPlugin);

  it('checks a typed or chosen blank through the plugin against the accept list', () => {
    expect(blank(payload, 'が')).toEqual({ result: 'correct' });
    expect(checkAnswer).toHaveBeenLastCalledWith('が', accept, false);
    const chosen = { ...payload, options: ['を', 'は', 'に'], testsKanji: true };
    expect(blank(chosen, 'は')).toEqual({ result: 'correct' });
    expect(checkAnswer).toHaveBeenLastCalledWith('は', accept, true);
    expect(blank(chosen, 'を')).toEqual({ result: 'wrong', feedback: 'は' });
  });

  it('rejects malformed payloads and answers', () => {
    for (const bad of [
      { ...payload, accept: [] },
      { ...payload, options: ['は'] },
      { ...payload, options: ['を', 'に'] },
      { ...payload, options: ['は', 'は', 'に'] },
      { ...payload, after: undefined },
    ]) {
      expect(() => blank(bad, 'は')).toThrow();
    }
    expect(() => blank(payload, 0)).toThrow();
  });
});

describe('EX-06 reorder grader', () => {
  // 私は 毎朝 コーヒーを 飲みます; 毎朝 私は コーヒーを 飲みます is also accepted.
  const payload = {
    prompt: 'I drink coffee every morning',
    answer: {
      text: '私は毎朝コーヒーを飲みます',
      tiles: [tile('私は'), tile('毎朝'), tile('コーヒーを'), tile('飲みます')],
    },
    acceptedOrders: [
      [0, 1, 2, 3],
      [1, 0, 2, 3],
    ],
  };

  it('accepts each accepted order', () => {
    expect(grade(REORDER_TYPE, payload, [0, 1, 2, 3])).toEqual({ result: 'correct' });
    expect(grade(REORDER_TYPE, payload, [1, 0, 2, 3])).toEqual({ result: 'correct' });
  });

  it('treats chunks with the same surface as interchangeable', () => {
    const twin = {
      prompt: 'It is a cat, a cat',
      answer: { text: '猫猫です', tiles: [tile('猫'), tile('猫'), tile('です')] },
      acceptedOrders: [[0, 1, 2]],
    };
    expect(grade(REORDER_TYPE, twin, [1, 0, 2])).toEqual({ result: 'correct' });
  });

  it('marks other orders and non-permutations wrong with the sentence', () => {
    const wrong = { result: 'wrong', feedback: '私は毎朝コーヒーを飲みます' };
    for (const answer of [
      [0, 2, 1, 3],
      [0, 1, 2],
      [0, 1, 2, 3, 3],
      [0, 1, 2, 9],
      [0, 0, 2, 3],
    ]) {
      expect(grade(REORDER_TYPE, payload, answer)).toEqual(wrong);
    }
  });

  it('rejects accepted orders that are not permutations, and too few chunks', () => {
    for (const acceptedOrders of [[], [[0, 1, 2]], [[0, 1, 2, 2]], [[0, 1, 2, 4]]]) {
      expect(() => grade(REORDER_TYPE, { ...payload, acceptedOrders }, [0])).toThrow();
    }
    const one = { ...payload, answer: { text: 'x', tiles: [tile('x')] }, acceptedOrders: [[0]] };
    expect(() => grade(REORDER_TYPE, one, [0])).toThrow();
  });

  it('rejects a payload that accepts every arrangement, since it would start solved', () => {
    const two = { prompt: 'p', answer: { text: 'ab', tiles: [tile('a'), tile('b')] } };
    expect(() => grade(REORDER_TYPE, { ...two, acceptedOrders: [[0, 1]] }, [0, 1])).not.toThrow();
    const both = {
      ...two,
      acceptedOrders: [
        [0, 1],
        [1, 0],
      ],
    };
    expect(() => grade(REORDER_TYPE, both, [0, 1])).toThrow('starts solved');
    const twins = { prompt: 'p', answer: { text: 'aa', tiles: [tile('a'), tile('a')] } };
    expect(() => grade(REORDER_TYPE, { ...twins, acceptedOrders: [[0, 1]] }, [0, 1])).toThrow(
      'starts solved',
    );
  });
});

describe('EX-09 reading in context grader', () => {
  const payload = {
    prompt: 'How is 学 read in 学校?',
    word: { text: '学校', itemId: 4 },
    kanji: { text: '学', itemId: 2 },
    options: [{ text: 'がく' }, { text: 'がっ' }, { text: 'まな' }],
    correct: 1,
  };

  it('accepts only the correct option and shows it otherwise', () => {
    expect(grade(READING_IN_CONTEXT_TYPE, payload, 1)).toEqual({ result: 'correct' });
    expect(grade(READING_IN_CONTEXT_TYPE, payload, 0)).toEqual({
      result: 'wrong',
      feedback: 'がっ',
    });
  });

  it('rejects malformed payloads and answers', () => {
    for (const bad of [
      { ...payload, correct: 3 },
      { ...payload, options: [{ text: 'がっ' }] },
      { ...payload, options: [{ text: 'がっ' }, { text: 'がっ' }] },
      { ...payload, kanji: { text: '水' } },
    ]) {
      expect(() => grade(READING_IN_CONTEXT_TYPE, bad, 0)).toThrow();
    }
    expect(() => grade(READING_IN_CONTEXT_TYPE, payload, 'がっ')).toThrow();
  });
});

describe('EX-10 conjugate grader', () => {
  const checkAnswer = jest.fn((given: string, accept: readonly { text: string }[]) =>
    accept.some((a) => a.text === given)
      ? { result: 'correct' as const }
      : { result: 'wrong' as const },
  );
  const conjugatePlugin = { checkAnswer } as unknown as LanguagePlugin;
  const accept = [{ text: '食べて', tiles: [tile('食べて')] }];
  const payload = { prompt: 'Te-form', word: '食べる', accept };
  const conjugate = (p: object, ...attempts: unknown[]) =>
    gradeResponse({ type: CONJUGATE_TYPE, payload: p }, { attempts }, conjugatePlugin);

  it('passes the plugin only the answer, accept list and testsKanji', () => {
    expect(conjugate(payload, '食べて')).toEqual({ result: 'correct' });
    expect(checkAnswer).toHaveBeenLastCalledWith('食べて', accept, false);
    expect(conjugate({ ...payload, testsKanji: true }, 'たべて')).toEqual({
      result: 'wrong',
      feedback: '食べて',
    });
    expect(checkAnswer).toHaveBeenLastCalledWith('たべて', accept, true);
  });

  it('rejects malformed payloads and answers', () => {
    expect(() => conjugate({ ...payload, accept: [] }, '食べて')).toThrow();
    expect(() => conjugate({ ...payload, word: '' }, '食べて')).toThrow();
    expect(() => conjugate(payload, 0)).toThrow();
  });
});

describe('EX-11 stroke trace grader', () => {
  const payload = { itemKey: 'ja:kanji:水', character: '水' };

  it('grades a finished trace correct, whatever the discarded strokes', () => {
    expect(grade(STROKE_TRACE_TYPE, payload, { mistakes: 0 })).toEqual({ result: 'correct' });
    expect(grade(STROKE_TRACE_TYPE, payload, { mistakes: 3 })).toEqual({ result: 'correct' });
  });

  it('rejects a malformed payload or answer', () => {
    expect(() => grade(STROKE_TRACE_TYPE, { ...payload, itemKey: '' }, { mistakes: 0 })).toThrow();
    expect(() => grade(STROKE_TRACE_TYPE, payload, { mistakes: -1 })).toThrow();
    expect(() => grade(STROKE_TRACE_TYPE, payload, 'done')).toThrow();
  });
});

describe('EX-12 draw from memory grader', () => {
  const payload = { itemKey: 'ja:kanji:水', character: '水', prompt: 'Draw "water"' };

  it('grades a finished drawing correct, whatever the missed strokes', () => {
    expect(grade(DRAW_MEMORY_TYPE, payload, { mistakes: 0 })).toEqual({ result: 'correct' });
    expect(grade(DRAW_MEMORY_TYPE, payload, { mistakes: 4 })).toEqual({ result: 'correct' });
  });

  it('rejects a payload without a prompt and a malformed answer', () => {
    expect(() => grade(DRAW_MEMORY_TYPE, { ...payload, prompt: '' }, { mistakes: 0 })).toThrow();
    expect(() => grade(DRAW_MEMORY_TYPE, payload, { mistakes: -1 })).toThrow();
  });
});

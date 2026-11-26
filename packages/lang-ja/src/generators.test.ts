import type { Exercise, GeneratorContext, GeneratorSentence, Item } from '@manabi/core';
import { getExerciseType, gradeResponse, payloadItemIds } from '@manabi/core';
import { generators, KANA_SECTION_LEVEL, readingInWord } from './generators';
import type { KanjiData } from './itemSchemas';
import japanese from './index';
import { courseKana } from './kana';
import { kanaToRomaji } from './romaji';

// FR-049, FR-048, FR-141: kana and vocabulary exercise generators.

let nextId = 1;
const item = (type: string, levelCode: string, data: object): Item => ({
  id: nextId++,
  courseId: 1,
  key: `k${nextId}`,
  type,
  levelCode,
  data: data as Item['data'],
  overrides: {},
  source: null,
  datasetVersion: null,
  archivedAt: null,
});
const kanaItem = (character: string) =>
  item(
    'kana',
    'kana',
    courseKana.find((k) => k.character === character)!,
  );
const word = (written: string, reading: string, ...meanings: string[]) =>
  item('word', 'N5', { written, reading, senses: [{ partsOfSpeech: ['n'], meanings }] });

const kana = [...'あいうえおかきくけこ'].map(kanaItem);
const words = [
  word('犬', 'いぬ', 'dog'),
  word('猫', 'ねこ', 'cat'),
  word('水', 'みず', 'water'),
  word('山', 'やま', 'mountain'),
  word('川', 'かわ', 'river'),
  word('食べる', 'たべる', 'to eat', 'to dine'),
];
const verb = (written: string, reading: string, pos: string) =>
  item('word', 'N5', { written, reading, senses: [{ partsOfSpeech: [pos], meanings: ['m'] }] });
const conjugable = [
  verb('食べる', 'たべる', 'v1'),
  verb('行く', 'いく', 'v5k-s'),
  verb('来る', 'くる', 'vk'),
  verb('高い', 'たかい', 'adj-i'),
  verb('静か', 'しずか', 'adj-na'),
];
const sentence: GeneratorSentence = {
  id: 9,
  text: '犬を見る。',
  tokens: [
    { surface: '犬', base: '犬', reading: 'いぬ', itemId: words[0]!.id },
    { surface: 'を', base: 'を', reading: 'を' },
    { surface: '見る', base: '見る', reading: 'みる' },
  ],
  translation: 'I see a dog.',
  grammar: [],
};
const context = (sectionLevel: string, taughtItems: Item[]): GeneratorContext => ({
  sectionLevel,
  taughtItems,
  sentences: [sentence],
});
const kanjiData = (character: string, onReadings: string[], kunReadings: string[]): KanjiData => ({
  character,
  meanings: ['m'],
  onReadings,
  kunReadings,
  strokeCount: 1,
  components: [],
});
const study = kanjiData('学', ['ガク'], ['まな.ぶ']);
const eat = kanjiData('食', ['ショク', 'ジキ'], ['く.う', 'た.べる']);
const kanji = [study, eat, kanjiData('火', ['カ'], ['ひ'])].map((k) => item('kanji', 'N5', k));
const kanjiWords = [word('学生', 'がくせい', 'student'), word('学校', 'がっこう', 'school')];
const kanjiContext = context('N5', [...words, ...kanji, ...kanjiWords]);
const conjugateContext = context('N5', [...words, ...conjugable]);
const kanaContext = context(KANA_SECTION_LEVEL, [...kana, ...words]);
const n5Context = context('N5', [...kana, ...words]);

/** Each generator run many times, since direction and distractors are random. */
const runs = (type: string, target: Item, ctx: GeneratorContext): Exercise[] =>
  Array.from({ length: 40 }, () => generators[type]!(target, ctx)).flat();

/** The answer each exercise type grades as correct. */
const rightAnswer = (e: Exercise): unknown => {
  const p = e.payload as Record<string, unknown>;
  if (e.type === 'choice' || e.type === 'reading_in_context') return p.correct;
  if (e.type === 'match_pairs') return [0, 1, 2, 3, 4];
  if (e.type === 'word_bank') return (p.acceptedOrders as number[][])[0];
  return (p.accept as { text: string }[])[0]!.text;
};

describe.each<[string, Item, GeneratorContext]>([
  ['choice', kana[5]!, kanaContext],
  ['choice', words[0]!, kanaContext],
  ['choice', words[5]!, n5Context],
  ['match_pairs', kana[0]!, kanaContext],
  ['match_pairs', words[1]!, n5Context],
  ['typed_answer', kana[2]!, kanaContext],
  ['typed_answer', words[5]!, n5Context],
  ['word_bank', words[0]!, n5Context],
  ['reading_in_context', kanji[0]!, kanjiContext],
  ['reading_in_context', kanji[1]!, kanjiContext],
  ...conjugable.map((w): [string, Item, GeneratorContext] => ['conjugate', w, conjugateContext]),
])('%s generator for %j', (type, target, ctx) => {
  const exercises = runs(type, target, ctx);

  it('builds payloads valid per the registry schema that grade correct with the right answer', () => {
    expect(exercises.length).toBeGreaterThan(0);
    for (const e of exercises) {
      expect(e.type).toBe(type);
      getExerciseType(type).payloadSchema.parse(e.payload);
      expect(gradeResponse(e, { attempts: [rightAnswer(e)] }, japanese)).toEqual({
        result: 'correct',
      });
    }
  });

  it('uses only taught items and names the target item', () => {
    const taught = new Set(ctx.taughtItems.map((i) => i.id));
    for (const e of exercises) {
      const ids = payloadItemIds(e.payload);
      expect(ids.every((id) => taught.has(id))).toBe(true);
      if (type !== 'typed_answer') expect(ids).toContain(target.id);
    }
  });
});

describe('EX-10 conjugate', () => {
  it('accepts the kanji and the kana spelling of the form', () => {
    const [e] = runs('conjugate', conjugable[1]!, conjugateContext).filter(
      (x) => (x.payload as { prompt: string }).prompt === 'Te-form',
    );
    expect(e!.payload).toMatchObject({
      word: '行く',
      accept: [{ text: '行って' }, { text: 'いって' }],
    });
    const tiles = (e!.payload as { accept: { tiles: unknown[] }[] }).accept.map((a) => a.tiles);
    expect(tiles).toEqual([
      [{ surface: '行って', base: '行く', reading: 'いって', itemId: conjugable[1]!.id }],
      [{ surface: 'いって', base: '行く', reading: 'いって', itemId: conjugable[1]!.id }],
    ]);
    expect(gradeResponse(e!, { attempts: ['いって'] }, japanese)).toEqual({ result: 'correct' });
    expect(gradeResponse(e!, { attempts: ['いいて'] }, japanese).result).toBe('wrong');
  });

  it('builds no exercise for words without a supported part-of-speech code', () => {
    const odd = [
      word('犬', 'いぬ', 'dog'),
      verb('今', 'いま', 'adv'),
      verb('勉強', 'べんきょう', 'vs'),
    ];
    for (const w of odd) expect(generators.conjugate!(w, conjugateContext)).toEqual([]);
    expect(generators.conjugate!(kana[0]!, conjugateContext)).toEqual([]);
  });
});

describe('EX-09 reading in context', () => {
  it.each([
    ['学生', 'がくせい', study, 'がく'],
    ['学校', 'がっこう', study, 'がっ'],
    ['大学', 'だいがく', study, 'がく'],
    ['学ぶ', 'まなぶ', study, 'まな'],
    ['食べ物', 'たべもの', eat, 'た'],
    ['お茶', 'おちゃ', kanjiData('茶', ['チャ', 'サ'], []), 'ちゃ'],
    ['日曜日', 'にちようび', kanjiData('日', ['ニチ'], ['ひ']), undefined],
    ['大学生', 'だいがくせい', study, undefined],
    ['水', 'みず', study, undefined],
  ])('reads the kanji in %s (%s)', (written, reading, data, expected) => {
    expect(readingInWord(data, written, reading)).toBe(expected);
  });

  it("asks about a taught word using the kanji, with the kanji's other readings as options", () => {
    for (const e of runs('reading_in_context', kanji[0]!, kanjiContext)) {
      const p = e.payload as {
        word: { text: string };
        options: { text: string }[];
        correct: number;
      };
      expect(['学生', '学校']).toContain(p.word.text);
      expect(p.options[p.correct]!.text).toBe(p.word.text === '学生' ? 'がく' : 'がっ');
      expect(p.options.map((o) => o.text)).toContain(p.word.text === '学生' ? 'まな' : 'がく');
    }
  });

  it('is left out when no taught word gives a sure reading', () => {
    expect(generators.reading_in_context!(kanji[2]!, kanjiContext)).toEqual([]);
    expect(generators.reading_in_context!(words[2]!, kanjiContext)).toEqual([]);
  });
});

describe('distractors', () => {
  it('are taught items of the same type and level, with the correct option present', () => {
    const sameKind = new Set(kana.map((i) => i.id));
    for (const e of runs('choice', kana[5]!, kanaContext)) {
      const { options, correct } = e.payload as { options: { itemId: number }[]; correct: number };
      expect(options[correct]!.itemId).toBe(kana[5]!.id);
      expect(options.every((o) => sameKind.has(o.itemId))).toBe(true);
    }
  });

  it('prefer look-alike kana', () => {
    const [nu, me] = [kanaItem('ぬ'), kanaItem('め')];
    const ctx = context(KANA_SECTION_LEVEL, [...kana, nu, me]);
    for (const e of runs('choice', nu, ctx)) {
      expect(payloadItemIds(e.payload)).toContain(me.id);
    }
  });

  it('ignore level in the kana section only', () => {
    const mixed = [word('あか', 'あか', 'red'), ...words.slice(0, 3)].map((w, i) => ({
      ...w,
      levelCode: ['kana', 'N5', 'N4', 'kana'][i]!,
    }));
    const kanaCtx = context(KANA_SECTION_LEVEL, mixed);
    for (const e of runs('choice', mixed[0]!, kanaCtx)) {
      expect(payloadItemIds(e.payload).sort()).toEqual(mixed.map((i) => i.id).sort());
    }
    expect(generators.choice!(mixed[0]!, context('N5', mixed))).toEqual([]);
  });

  it('are left out when too few taught items differ, so nothing is generated', () => {
    const ctx = context('N5', words.slice(0, 3));
    expect(generators.choice!(words[0]!, ctx)).toEqual([]);
    expect(generators.match_pairs!(words[0]!, ctx)).toEqual([]);
  });

  it('prefer the script of the target kana', () => {
    const katakana = [...'カキクケ'].map(kanaItem);
    const ctx = context(KANA_SECTION_LEVEL, [...kana, ...katakana]);
    for (const e of runs('choice', katakana[0]!, ctx)) {
      expect(payloadItemIds(e.payload).sort()).toEqual(katakana.map((i) => i.id).sort());
    }
  });

  it('never share any meaning with the target or each other', () => {
    // 分かる's second meaning is 知る's first.
    const know = word('知る', 'しる', 'to know');
    const understand = word('分かる', 'わかる', 'to understand', 'to know');
    const ctx = context('N5', [...words, know, understand]);
    for (const type of ['choice', 'match_pairs']) {
      for (const target of [know, understand]) {
        for (const e of runs(type, target, ctx)) {
          const ids = payloadItemIds(e.payload);
          expect(ids.includes(know.id) && ids.includes(understand.id)).toBe(false);
        }
      }
      for (const e of runs(type, words[0]!, ctx)) {
        const ids = payloadItemIds(e.payload);
        expect(ids.includes(know.id) && ids.includes(understand.id)).toBe(false);
      }
    }
  });

  it('never share a meaning with the target', () => {
    const eat = word('食う', 'くう', 'to eat');
    const ctx = context('N5', [...words, eat]);
    for (const e of runs('choice', words[5]!, ctx)) {
      expect(payloadItemIds(e.payload)).not.toContain(eat.id);
    }
  });
});

describe('author overrides (DR-09)', () => {
  it('replace the imported fields they name', () => {
    const rain = {
      ...word('あめ', 'あめ', 'candy'),
      overrides: { senses: [{ meanings: ['rain'] }] },
    };
    const ctx = context('N5', [...words, rain]);
    const accepted = runs('typed_answer', rain, ctx).flatMap((e) =>
      (e.payload as { accept: { text: string }[] }).accept.map((a) => a.text),
    );
    expect(accepted).toContain('rain');
    expect(accepted).not.toContain('candy');
  });
});

describe('romaji (FR-141)', () => {
  it('is shown for kana-section lessons', () => {
    const json = JSON.stringify(runs('choice', kana[5]!, kanaContext));
    expect(json).toContain('"ka"');
    const prompts = runs('typed_answer', words[0]!, kanaContext).map(
      (e) => (e.payload as { prompt: string }).prompt,
    );
    expect(prompts).toContain('What does 犬 (inu) mean?');
  });

  it('is absent otherwise', () => {
    for (const type of ['choice', 'match_pairs', 'typed_answer']) {
      expect(generators[type]!(kana[5]!, n5Context)).toEqual([]);
      const json = JSON.stringify(runs(type, words[0]!, n5Context));
      expect(json).not.toContain('inu');
    }
  });
});

describe('kanaToRomaji', () => {
  it.each([
    ['いぬ', 'inu'],
    ['きって', 'kitte'],
    ['きょう', 'kyou'],
    ['しゃしん', 'shashin'],
    ['じゅう', 'juu'],
    ['まっちゃ', 'matcha'],
    ['コーヒー', 'koohii'],
  ])('%s is %s', (text, romaji) => {
    expect(kanaToRomaji(text)).toBe(romaji);
  });
});

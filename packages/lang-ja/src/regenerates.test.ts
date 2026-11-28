import type { Exercise, GeneratorContext, GeneratorSentence, Item, PinContent } from '@manabi/core';
import { generators, KANA_SECTION_LEVEL } from './generators';
import type { KanjiData } from './itemSchemas';
import { courseKana } from './kana';
import { regenerates } from './regenerates';

// #259, SDD section 6: a pin's original is still generated when `regenerates` says so. Every
// exercise a generator makes passes; one whose item-derived fields changed does not.

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
const word = (written: string, reading: string, pos: string, ...meanings: string[]) =>
  item('word', 'N5', { written, reading, senses: [{ partsOfSpeech: [pos], meanings }] });
const kanjiData = (character: string, onReadings: string[], kunReadings: string[]): KanjiData => ({
  character,
  meanings: ['m'],
  onReadings,
  kunReadings,
  strokeCount: 1,
  components: [],
});

const kana = [...'あいうえおかきくけこ'].map(kanaItem);
const words = [
  word('犬', 'いぬ', 'n', 'dog'),
  word('猫', 'ねこ', 'n', 'cat'),
  word('水', 'みず', 'n', 'water'),
  word('山', 'やま', 'n', 'mountain'),
  word('川', 'かわ', 'n', 'river'),
  word('食べる', 'たべる', 'v1', 'to eat', 'to dine'),
  word('学生', 'がくせい', 'n', 'student'),
  word('学校', 'がっこう', 'n', 'school'),
];
const kanji = [
  kanjiData('学', ['ガク'], ['まな.ぶ']),
  kanjiData('食', ['ショク', 'ジキ'], ['く.う', 'た.べる']),
  kanjiData('火', ['カ'], ['ひ']),
].map((k) => item('kanji', 'N5', k));
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
const content = (sectionLevel: string, items: Item[]): PinContent => ({
  sectionLevel,
  items,
  sentences: [sentence],
});
const kanaContent = content(KANA_SECTION_LEVEL, kana);
const n5Content = content('N5', [...words, ...kanji]);

/** Many runs of every generator over every item, so each random choice is taken. */
function generated(c: PinContent, items: Item[]): { item: Item; exercise: Exercise }[] {
  const out: { item: Item; exercise: Exercise }[] = [];
  for (const facet of [undefined, 'meaning', 'reading']) {
    const context: GeneratorContext = {
      sectionLevel: c.sectionLevel,
      taughtItems: c.items,
      sentences: c.sentences,
      ...(facet ? { facet } : {}),
    };
    for (let run = 0; run < 15; run++) {
      for (const i of items) {
        for (const generate of Object.values(generators)) {
          for (const exercise of generate(i, context)) out.push({ item: i, exercise });
        }
      }
    }
  }
  return out;
}

const all = [...generated(kanaContent, kana), ...generated(n5Content, [...words, ...kanji])];
/** A pin's recorded original: the payload without its accept list (#254). */
const original = ({ type, payload }: Exercise): Exercise => {
  const rest = { ...(payload as Record<string, unknown>) };
  delete rest.accept;
  return { type, payload: rest };
};
const contentOf = (i: Item) => (i.levelCode === 'kana' ? kanaContent : n5Content);

describe('regenerates', () => {
  it('passes every exercise the generators make, with and without its accept list', () => {
    for (const { item: i, exercise } of all) {
      expect([exercise.type, regenerates(exercise, i, contentOf(i))]).toEqual([
        exercise.type,
        true,
      ]);
      expect([exercise.type, regenerates(original(exercise), i, contentOf(i))]).toEqual([
        exercise.type,
        true,
      ]);
    }
  });

  it('has a check for every generator, which catches a changed prompt or text', () => {
    const types = new Set(all.map((g) => g.exercise.type));
    expect([...types].sort()).toEqual(Object.keys(generators).sort());
    for (const type of types) {
      const { item: i, exercise } = all.find((g) => g.exercise.type === type)!;
      const payload = JSON.parse(JSON.stringify(exercise.payload)) as Record<string, unknown>;
      // Every generated payload has a prompt, or (stroke tracing, match pairs) a character/pairs.
      if (typeof payload.prompt === 'string') payload.prompt += ' (old wording)';
      else if (typeof payload.character === 'string') payload.character = '別';
      else (payload.pairs as { term: string }[])[0]!.term = '別';
      expect([type, regenerates({ type, payload }, i, contentOf(i))]).toEqual([type, false]);
    }
  });

  it('marks an original detached once the item data it was made from changes', () => {
    const dog = words[0]!;
    const asked = {
      type: 'typed_answer',
      payload: { prompt: 'What does 犬 mean?', answerLanguage: 'base' },
    };
    expect(regenerates(asked, dog, n5Content)).toBe(true);
    const renamed: Item = { ...dog, overrides: { written: '狗' } };
    expect(regenerates(asked, renamed, n5Content)).toBe(false);
  });

  it('does not depend on which distractors or option order were picked', () => {
    const choices = all.filter((g) => g.exercise.type === 'choice' && g.item.id === words[1]!.id);
    expect(new Set(choices.map((g) => JSON.stringify(g.exercise.payload))).size).toBeGreaterThan(1);
    for (const { item: i, exercise } of choices)
      expect(regenerates(exercise, i, n5Content)).toBe(true);
  });

  it('marks a word bank detached once its sentence is gone or changed', () => {
    const bank = all.find((g) => g.exercise.type === 'word_bank')!;
    expect(regenerates(bank.exercise, bank.item, { ...n5Content, sentences: [] })).toBe(false);
    const changed = { ...sentence, translation: 'I look at a dog.' };
    expect(regenerates(bank.exercise, bank.item, { ...n5Content, sentences: [changed] })).toBe(
      false,
    );
  });

  it('answers true for a type it has no check for', () => {
    expect(regenerates({ type: 'no-such-type', payload: {} }, words[0]!, n5Content)).toBe(true);
  });
});

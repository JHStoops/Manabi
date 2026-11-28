import type {
  ChoicePayload,
  ConjugatePayload,
  DrawMemoryPayload,
  ExerciseGenerator,
  GeneratorContext,
  Item,
  MatchPairsPayload,
  ReadingInContextPayload,
  StrokeTracePayload,
  Tile,
  TypedAnswerPayload,
  WordBankPayload,
} from '@manabi/core';
import {
  CHOICE_TYPE,
  CONJUGATE_TYPE,
  DRAW_MEMORY_TYPE,
  MATCH_PAIRS_TYPE,
  READING_IN_CONTEXT_TYPE,
  STROKE_TRACE_TYPE,
  TYPED_ANSWER_TYPE,
  WORD_BANK_TYPE,
} from '@manabi/core';
import { toHiragana } from './answer';
import { conjugate, FORM_LABELS, formsFor } from './conjugate';
import type { KanjiData } from './itemSchemas';
import { kanaDataSchema, kanjiDataSchema, wordDataSchema } from './itemSchemas';
import { kanaToRomaji } from './romaji';
import { tokenize } from './tokenize';

// FR-049: exercises generated from kana, word and kanji items for kana, vocabulary and kanji
// lessons (Product Spec sections 4 and 5, exercise catalog). FR-048: the session builder passes
// only taught items.

/** FR-141: the kana section is the section at this level; romaji is shown only there. */
export const KANA_SECTION_LEVEL = 'kana';

// Look-alike kana, one group per string; kana differing only by voicing marks (か, が) look alike too.
const LOOK_ALIKES =
  'ぬめ われね るろ はほ きさち いり こに あお まも うつ ソン シツ クケタ ノメ ウワフ コユ チテ スヌ アマ ルレ エニ セサ'.split(
    ' ',
  );
const looksAlike = (a: string, b: string) =>
  a.normalize('NFD')[0] === b.normalize('NFD')[0] ||
  LOOK_ALIKES.some((group) => group.includes(a) && group.includes(b));

/** A copy of `items` in random order (Fisher-Yates). */
function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** DR-09: an item's data with the author's overrides applied, field by field. */
export const effective = (item: Item) => ({ ...item.data, ...item.overrides });

const KANA_ONLY = /^[ぁ-ゟ゠-ヿ]*$/u;

/** A kanji's readings in hiragana, without okurigana and prefix or suffix marks, distinct. */
export const readingsOf = (kanji: KanjiData) => [
  ...new Set(
    [...kanji.onReadings, ...kanji.kunReadings].map((r) =>
      toHiragana(r.split('.')[0]!.replace(/-/g, '')),
    ),
  ),
];

/** An item as exercises show it: its term (か, 水) and gloss (ka, water), with prompts for both. */
export interface Card {
  item: Item;
  /** A kanji's data, for ranking look-alike distractors. */
  kanji?: KanjiData;
  term: string;
  reading: string;
  gloss: string;
  /** Every accepted typed gloss. */
  glosses: string[];
  /** Asks for the gloss of the term. */
  termPrompt: string;
  /** Asks for the term with this gloss. */
  glossPrompt: string;
}

// shortcut: prompts are English, the only base language so far; upgrade when a course from
// another base language ships.
export function card(item: Item, context: GeneratorContext): Card | undefined {
  const romaji = context.sectionLevel === KANA_SECTION_LEVEL;
  if (item.type === 'kana') {
    const kana = kanaDataSchema.safeParse(effective(item)).data;
    // A kana's gloss is its romaji, so kana exercises exist only in the kana section (FR-141).
    if (!kana || !romaji) return undefined;
    const { character, romaji: sound } = kana;
    return {
      item,
      term: character,
      reading: character,
      gloss: sound,
      glosses: [sound],
      termPrompt: `What sound is ${character}?`,
      glossPrompt: `Which kana is “${sound}”?`,
    };
  }
  if (item.type === 'word') {
    const word = wordDataSchema.safeParse(effective(item)).data;
    if (!word) return undefined;
    const glosses = word.senses.flatMap((sense) => sense.meanings);
    const shown = romaji ? `${word.written} (${kanaToRomaji(word.reading)})` : word.written;
    return {
      item,
      term: word.written,
      reading: word.reading,
      gloss: glosses[0]!,
      glosses,
      termPrompt: `What does ${shown} mean?`,
      glossPrompt: `Which word means “${glosses[0]!}”?`,
    };
  }
  if (item.type === 'kanji') {
    const kanji = kanjiDataSchema.safeParse(effective(item)).data;
    if (!kanji) return undefined;
    const { character, meanings } = kanji;
    return {
      item,
      kanji,
      term: character,
      reading: readingsOf(kanji)[0] ?? character,
      gloss: meanings[0]!,
      glosses: meanings,
      termPrompt: `What does the kanji ${character} mean?`,
      glossPrompt: `Which kanji means “${meanings[0]!}”?`,
    };
  }
  return undefined;
}

/**
 * How much two kanji look alike: shared components count most, then a close stroke count
 * (Product Spec section 5: distractors prefer look-alike kanji of the same level).
 */
function kanjiLikeness(a: KanjiData, b: KanjiData): number {
  const shared = a.components.filter((c) => b.components.includes(c)).length;
  return 2 * shared + Number(Math.abs(a.strokeCount - b.strokeCount) <= 2);
}

/**
 * `count` taught items of the target's type and level (any level in the kana section) whose terms
 * differ and whose glosses do not overlap the target's or each other's; for kana, look-alikes
 * first, then the target's script (so the script does not give the answer away); for kanji,
 * look-alikes first. Undefined when there are not enough.
 */
function distractors(target: Card, context: GeneratorContext, count: number): Card[] | undefined {
  const { item } = target;
  // Kana-section words keep their level-list levels (kana, N5, N4), so there any level will do.
  const anyLevel = context.sectionLevel === KANA_SECTION_LEVEL;
  const katakana = (term: string) => /[ァ-ヶ]/.test(term);
  const rank = (c: Card) =>
    item.type === 'kana'
      ? 2 * Number(looksAlike(target.term, c.term)) +
        Number(katakana(c.term) === katakana(target.term))
      : target.kanji && c.kanji
        ? kanjiLikeness(target.kanji, c.kanji)
        : 0;
  const pool = shuffled(
    context.taughtItems.flatMap((other) => {
      const c =
        other.id !== item.id &&
        other.type === item.type &&
        (anyLevel || other.levelCode === item.levelCode)
          ? card(other, context)
          : undefined;
      return c ? [c] : [];
    }),
  ).sort((a, b) => rank(b) - rank(a));
  const picked: Card[] = [];
  for (const c of pool) {
    if (picked.length === count) break;
    const clash = [target, ...picked].some(
      (p) => p.term === c.term || p.glosses.some((g) => c.glosses.includes(g)),
    );
    if (!clash) picked.push(c);
  }
  return picked.length === count ? picked : undefined;
}

/** EX-01: the item's gloss from its term, or its term from its gloss, among 3 distractors. */
const choice: ExerciseGenerator = (item, context) => {
  const target = card(item, context);
  const others = target && distractors(target, context, 3);
  if (!target || !others) return [];
  const options = shuffled([target, ...others]);
  const fromTerm = Math.random() < 0.5;
  const payload: ChoicePayload = {
    prompt: fromTerm ? target.termPrompt : target.glossPrompt,
    options: options.map((c) => ({ text: fromTerm ? c.gloss : c.term, itemId: c.item.id })),
    correct: options.indexOf(target),
  };
  return [{ type: CHOICE_TYPE, payload }];
};

/** EX-02: the item and 4 distractors, each term paired with its gloss. */
const matchPairs: ExerciseGenerator = (item, context) => {
  const target = card(item, context);
  const others = target && distractors(target, context, 4);
  if (!target || !others) return [];
  const payload: MatchPairsPayload = {
    pairs: shuffled([target, ...others]).map((c) => ({
      term: c.term,
      match: c.gloss,
      itemId: c.item.id,
    })),
  };
  return [{ type: MATCH_PAIRS_TYPE, payload }];
};

/** EX-03: a word's sentence built from its tiles, plus up to 2 other taught words as tiles. */
const wordBank: ExerciseGenerator = (item, { sentences, taughtItems }) => {
  const sentence = shuffled(sentences.filter((s) => s.tokens.some((t) => t.itemId === item.id)))[0];
  if (item.type !== 'word' || !sentence) return [];
  const tiles = tokenize({ text: sentence.text, tiles: sentence.tokens });
  const extra = shuffled(taughtItems).flatMap((other): Tile[] => {
    const word =
      other.type === 'word' ? wordDataSchema.safeParse(effective(other)).data : undefined;
    return word && !tiles.some((t) => t.surface === word.written)
      ? [{ surface: word.written, base: word.written, reading: word.reading, itemId: other.id }]
      : [];
  });
  const payload: WordBankPayload = {
    prompt: sentence.translation,
    answer: { text: sentence.text, tiles },
    distractors: extra.slice(0, 2),
    acceptedOrders: [tiles.map((_, i) => i)],
  };
  return [{ type: WORD_BANK_TYPE, payload }];
};

/**
 * Taught words that use `kanji`, each with the kanji's reading in it (where it can be told), in
 * random order.
 */
export function kanjiUses(kanji: KanjiData, taughtItems: readonly Item[]) {
  return shuffled(taughtItems).flatMap((other) => {
    const word =
      other.type === 'word' ? wordDataSchema.safeParse(effective(other)).data : undefined;
    const reading = word && readingInWord(kanji, word.written, word.reading);
    return word && reading ? [{ item: other, written: word.written, reading }] : [];
  });
}

/** Hiragana as katakana (the reverse of `toHiragana`). */
const toKatakana = (text: string) =>
  text.replace(/[ぁ-ゖ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

/** EX-04 for a kanji's `reading` facet: type how the kanji is read in a taught word that uses it. */
function typedKanjiReading(item: Item, kanji: KanjiData, context: GeneratorContext) {
  const use = kanjiUses(kanji, context.taughtItems)[0];
  if (!use) return [];
  const payload: TypedAnswerPayload = {
    prompt: `Type the reading of ${kanji.character} in ${use.written}.`,
    answerLanguage: 'target',
    // Teaching cards show on readings in katakana, as KANJIDIC writes them; both scripts count.
    accept: [use.reading, toKatakana(use.reading)].map((text) => ({
      text,
      tiles: [{ surface: text, base: text, reading: use.reading, itemId: item.id }],
    })),
  };
  return [{ type: TYPED_ANSWER_TYPE, payload }];
}

/**
 * EX-04: type the gloss of a term, or a word from its meaning. A kana is only asked for its sound:
 * typed as kana, its romaji would turn into the shown kana itself. A kanji is asked for its
 * meaning, or for its reading in a word when the facet asked for is `reading`.
 */
const typedAnswer: ExerciseGenerator = (item, context) => {
  const target = card(item, context);
  if (!target) return [];
  if (target.kanji && context.facet === 'reading') {
    return typedKanjiReading(item, target.kanji, context);
  }
  const toTerm = item.type === 'word' && Math.random() < 0.5;
  const tile = {
    surface: target.term,
    base: target.term,
    reading: target.reading,
    itemId: item.id,
  };
  const payload: TypedAnswerPayload = toTerm
    ? {
        prompt: target.glossPrompt,
        answerLanguage: 'target',
        accept: [{ text: target.term, tiles: [tile] }],
      }
    : {
        prompt: target.termPrompt,
        answerLanguage: 'base',
        accept: target.glosses.map((text) => ({ text, tiles: [] })),
      };
  return [{ type: TYPED_ANSWER_TYPE, payload }];
};

/**
 * The reading of `kanji` inside a word, or undefined when it cannot be told for sure: the kanji
 * must appear once, and the kana around it fix the reading, or one of its readings (or the
 * sokuon form, がく as がっ) is the only one that fits next to the other kanji.
 */
// shortcut: rendaku (かわ as がわ) and words with kanji on both sides are skipped; upgrade when
// kanji lessons run short of reading exercises.
export function readingInWord(kanji: KanjiData, written: string, reading: string) {
  const at = written.indexOf(kanji.character);
  if (at < 0 || at !== written.lastIndexOf(kanji.character)) return undefined;
  const [before, after] = [written.slice(0, at), written.slice(at + kanji.character.length)];
  const [kanaBefore, kanaAfter] = [KANA_ONLY.test(before), KANA_ONLY.test(after)];
  const whole = toHiragana(reading);
  if (kanaBefore && !whole.startsWith(toHiragana(before))) return undefined;
  if (kanaAfter && !whole.endsWith(toHiragana(after))) return undefined;
  if (kanaBefore && kanaAfter) {
    const middle = whole.slice(before.length, whole.length - after.length);
    return middle || undefined;
  }
  const candidates = readingsOf(kanji).flatMap((r) =>
    /[くつちき]$/u.test(r) ? [r, `${r.slice(0, -1)}っ`] : [r],
  );
  const fits = kanaBefore
    ? candidates.filter((r) => whole.startsWith(toHiragana(before) + r))
    : kanaAfter
      ? candidates.filter((r) => whole.endsWith(r + toHiragana(after)))
      : [];
  return fits.length === 1 ? fits[0] : undefined;
}

/**
 * EX-09: how a kanji is read in a taught word that uses it, among up to 3 wrong readings: the
 * kanji's own other readings first, then readings of other taught kanji of its level.
 */
const readingInContext: ExerciseGenerator = (item, { taughtItems }) => {
  const kanji = item.type === 'kanji' ? kanjiDataSchema.safeParse(effective(item)).data : undefined;
  if (!kanji) return [];
  const use = kanjiUses(kanji, taughtItems)[0];
  if (!use) return [];
  const others = shuffled(
    taughtItems.flatMap((other) => {
      const data =
        other.id !== item.id && other.type === 'kanji' && other.levelCode === item.levelCode
          ? kanjiDataSchema.safeParse(effective(other)).data
          : undefined;
      return data ? readingsOf(data) : [];
    }),
  );
  const wrong = [...new Set([...shuffled(readingsOf(kanji)), ...others])]
    .filter((r) => r !== use.reading)
    .slice(0, 3);
  if (wrong.length === 0) return [];
  const options = shuffled([use.reading, ...wrong]);
  const payload: ReadingInContextPayload = {
    prompt: `How is ${kanji.character} read in ${use.written}?`,
    word: { text: use.written, itemId: use.item.id },
    kanji: { text: kanji.character, itemId: item.id },
    options: options.map((text) => ({ text })),
    correct: options.indexOf(use.reading),
  };
  return [{ type: READING_IN_CONTEXT_TYPE, payload }];
};

/**
 * EX-10: the requested form of a taught verb or adjective, accepting its kanji and kana
 * spellings. Words with no supported part-of-speech code get no exercise.
 */
// shortcut: the form is picked at random from those the word's class supports; a grammar point
// cannot yet name the forms it drills (its formation rows), upgrade with the grammar drills.
const conjugateGenerator: ExerciseGenerator = (item) => {
  const word = item.type === 'word' ? wordDataSchema.safeParse(effective(item)).data : undefined;
  const pos = word?.senses.flatMap((s) => s.partsOfSpeech).find((code) => formsFor(code).length);
  if (!word || !pos) return [];
  const form = shuffled(formsFor(pos))[0]!;
  const [written, reading] = [word.written, word.reading].map((text) => conjugate(text, pos, form));
  if (!written || !reading) return [];
  const payload: ConjugatePayload = {
    prompt: FORM_LABELS[form],
    word: word.written,
    accept: [...new Set([written, reading])].map((text) => ({
      text,
      tiles: [{ surface: text, base: word.written, reading, itemId: item.id }],
    })),
  };
  return [{ type: CONJUGATE_TYPE, payload }];
};

/** The character a kanji or kana item is drawn as, or undefined for other items. */
export function drawnCharacter(item: Item): string | undefined {
  const data = effective(item);
  if (item.type === 'kanji') return kanjiDataSchema.safeParse(data).data?.character;
  if (item.type === 'kana') return kanaDataSchema.safeParse(data).data?.character;
  return undefined;
}

/**
 * EX-11: trace a kanji or kana over its guide. The session builder leaves drawing exercises out
 * for characters without stroke data.
 */
const strokeTrace: ExerciseGenerator = (item) => {
  const character = drawnCharacter(item);
  if (!character) return [];
  const payload: StrokeTracePayload = { itemKey: item.key, character };
  return [{ type: STROKE_TRACE_TYPE, payload }];
};

/** EX-12: draw a kanji from memory, given its primary meaning. */
// shortcut: kanji only; a kana would be asked by its romaji, which only the kana section shows
// (FR-141). Add it if kana lessons get a drawing step.
const drawMemory: ExerciseGenerator = (item) => {
  const kanji = item.type === 'kanji' ? kanjiDataSchema.safeParse(effective(item)).data : undefined;
  if (!kanji) return [];
  const payload: DrawMemoryPayload = {
    itemKey: item.key,
    character: kanji.character,
    prompt: `Draw the kanji that means “${kanji.meanings[0]!}”.`,
  };
  return [{ type: DRAW_MEMORY_TYPE, payload }];
};

/** Exercise generators keyed by exercise type id. */
export const generators: Record<string, ExerciseGenerator> = {
  [CHOICE_TYPE]: choice,
  [MATCH_PAIRS_TYPE]: matchPairs,
  [WORD_BANK_TYPE]: wordBank,
  [TYPED_ANSWER_TYPE]: typedAnswer,
  [READING_IN_CONTEXT_TYPE]: readingInContext,
  [CONJUGATE_TYPE]: conjugateGenerator,
  [STROKE_TRACE_TYPE]: strokeTrace,
  [DRAW_MEMORY_TYPE]: drawMemory,
};

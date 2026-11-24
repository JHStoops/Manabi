import type {
  ChoicePayload,
  ExerciseGenerator,
  GeneratorContext,
  Item,
  MatchPairsPayload,
  Tile,
  TypedAnswerPayload,
  WordBankPayload,
} from '@manabi/core';
import { CHOICE_TYPE, MATCH_PAIRS_TYPE, TYPED_ANSWER_TYPE, WORD_BANK_TYPE } from '@manabi/core';
import { kanaDataSchema, wordDataSchema } from './itemSchemas';
import { kanaToRomaji } from './romaji';
import { tokenize } from './tokenize';

// FR-049: exercises generated from kana and word items for kana and vocabulary lessons (Product
// Spec section 4, exercise catalog). FR-048: the session builder passes only taught items.

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
const effective = (item: Item) => ({ ...item.data, ...item.overrides });

/** An item as exercises show it: its term (か, 水) and gloss (ka, water), with prompts for both. */
interface Card {
  item: Item;
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
function card(item: Item, context: GeneratorContext): Card | undefined {
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
  return undefined;
}

/**
 * `count` taught items of the target's type and level (any level in the kana section) whose terms differ and whose glosses do not
 * overlap the target's or each other's; for kana, look-alikes first, then the target's script (so
 * the script does not give the answer away). Undefined when there are not enough.
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
 * EX-04: type the gloss of a term, or a word from its meaning. A kana is only asked for its sound:
 * typed as kana, its romaji would turn into the shown kana itself.
 */
const typedAnswer: ExerciseGenerator = (item, context) => {
  const target = card(item, context);
  if (!target) return [];
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

/** Exercise generators keyed by exercise type id. */
export const generators: Record<string, ExerciseGenerator> = {
  [CHOICE_TYPE]: choice,
  [MATCH_PAIRS_TYPE]: matchPairs,
  [WORD_BANK_TYPE]: wordBank,
  [TYPED_ANSWER_TYPE]: typedAnswer,
};

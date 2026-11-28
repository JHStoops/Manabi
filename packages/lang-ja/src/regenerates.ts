import type { Exercise, GeneratorContext, Item, PinContent } from '@manabi/core';
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
import { FORM_LABELS, formsFor } from './conjugate';
import { card, drawnCharacter, effective, kanjiUses, readingsOf } from './generators';
import { kanjiDataSchema, wordDataSchema } from './itemSchemas';
import { tokenize } from './tokenize';

// #259, SDD section 6: whether a generator could still ask a pin's recorded original about its
// item. Only what each generator in generators.ts derives from items and sentences is compared
// (prompts, terms, glosses, readings, sentence text); the random parts (option order, which
// distractors, the direction, the word or form picked) only have to be ones the generator could
// pick. The accept list is not compared: a pin's original is recorded without it (#254). Keep
// each check in step with its generator; regenerates.test.ts generates exercises and checks that
// every one passes.

type Payload = Record<string, unknown>;

const isObject = (value: unknown): value is Payload =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** JSON with sorted object keys, so equal values compare equal whatever their key order. */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    isObject(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v,
  );
const same = (a: unknown, b: unknown) => stable(a) === stable(b);

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** The items a payload names (`itemId`), looked up among `items`, plus the item itself. */
function itemFinder(item: Item, content: PinContent) {
  const byId = new Map(content.items.map((i) => [i.id, i]));
  byId.set(item.id, item);
  return (id: unknown) => (typeof id === 'number' ? byId.get(id) : undefined);
}

const contextOf = (content: PinContent): GeneratorContext => ({
  sectionLevel: content.sectionLevel,
  taughtItems: content.items,
  sentences: content.sentences,
});

/** EX-01: the target's prompt, and every option's text is its own item's gloss or term. */
function choice(payload: Payload, item: Item, content: PinContent): boolean {
  const context = contextOf(content);
  const target = card(item, context);
  const options = list(payload.options);
  if (!target || options.length !== 4) return false;
  const fromTerm = payload.prompt === target.termPrompt;
  if (!fromTerm && payload.prompt !== target.glossPrompt) return false;
  const find = itemFinder(item, content);
  const correct = options[Number(payload.correct)];
  if (!isObject(correct) || correct.itemId !== item.id) return false;
  return options.every((o) => {
    const other = isObject(o) ? find(o.itemId) : undefined;
    const c = other && card(other, context);
    return !!c && isObject(o) && o.text === (fromTerm ? c.gloss : c.term);
  });
}

/** EX-02: five pairs, the item's among them, each its own item's term and gloss. */
function matchPairs(payload: Payload, item: Item, content: PinContent): boolean {
  const context = contextOf(content);
  const pairs = list(payload.pairs);
  if (pairs.length !== 5 || !pairs.some((p) => isObject(p) && p.itemId === item.id)) return false;
  const find = itemFinder(item, content);
  return pairs.every((p) => {
    const other = isObject(p) ? find(p.itemId) : undefined;
    const c = other && card(other, context);
    return !!c && isObject(p) && p.term === c.term && p.match === c.gloss;
  });
}

/** EX-03: a sentence of the word, unchanged, and up to two other words as extra tiles. */
function wordBank(payload: Payload, item: Item, content: PinContent): boolean {
  if (item.type !== 'word' || !isObject(payload.answer)) return false;
  const { answer } = payload;
  const sentence = content.sentences.find(
    (s) =>
      s.text === answer.text &&
      s.translation === payload.prompt &&
      s.tokens.some((t) => t.itemId === item.id),
  );
  if (!sentence) return false;
  const tiles = tokenize({ text: sentence.text, tiles: sentence.tokens });
  if (!same(answer.tiles, tiles) || !same(payload.acceptedOrders, [tiles.map((_, i) => i)])) {
    return false;
  }
  const find = itemFinder(item, content);
  const extra = list(payload.distractors);
  return (
    extra.length <= 2 &&
    extra.every((t) => {
      const other = isObject(t) ? find(t.itemId) : undefined;
      const word =
        other?.type === 'word' ? wordDataSchema.safeParse(effective(other)).data : undefined;
      return (
        !!word &&
        same(t, {
          surface: word.written,
          base: word.written,
          reading: word.reading,
          itemId: other!.id,
        })
      );
    })
  );
}

/** EX-04: the item's prompt in the answer language it asks for. */
function typedAnswer(payload: Payload, item: Item, content: PinContent): boolean {
  const target = card(item, contextOf(content));
  if (!target) return false;
  if (payload.prompt === target.termPrompt) return payload.answerLanguage === 'base';
  if (item.type === 'word' && payload.prompt === target.glossPrompt) {
    return payload.answerLanguage === 'target';
  }
  // A kanji's reading facet: its reading in one of the taught words that use it.
  return (
    !!target.kanji &&
    payload.answerLanguage === 'target' &&
    kanjiUses(target.kanji, content.items).some(
      (use) =>
        payload.prompt === `Type the reading of ${target.kanji!.character} in ${use.written}.`,
    )
  );
}

/** EX-09: the kanji's reading in a taught word that uses it, among readings it could pick. */
function readingInContext(payload: Payload, item: Item, content: PinContent): boolean {
  const kanji = item.type === 'kanji' ? kanjiDataSchema.safeParse(effective(item)).data : undefined;
  const options = list(payload.options);
  const correct = options[Number(payload.correct)];
  if (!kanji || !isObject(correct) || !isObject(payload.word)) return false;
  const { word } = payload;
  const use = kanjiUses(kanji, content.items).find(
    (u) => u.item.id === word.itemId && u.written === word.text,
  );
  if (!use || correct.text !== use.reading) return false;
  if (payload.prompt !== `How is ${kanji.character} read in ${use.written}?`) return false;
  if (!same(payload.kanji, { text: kanji.character, itemId: item.id })) return false;
  const wrong = new Set([
    ...readingsOf(kanji),
    ...content.items.flatMap((other) => {
      const data =
        other.id !== item.id && other.type === 'kanji' && other.levelCode === item.levelCode
          ? kanjiDataSchema.safeParse(effective(other)).data
          : undefined;
      return data ? readingsOf(data) : [];
    }),
  ]);
  return (
    options.length >= 2 &&
    options.every((o) => isObject(o) && (o === correct || wrong.has(String(o.text))))
  );
}

/** EX-10: a form the word's class supports, of the word as written now. */
function conjugate(payload: Payload, item: Item): boolean {
  const word = item.type === 'word' ? wordDataSchema.safeParse(effective(item)).data : undefined;
  const pos = word?.senses.flatMap((s) => s.partsOfSpeech).find((code) => formsFor(code).length);
  return (
    !!word &&
    !!pos &&
    payload.word === word.written &&
    formsFor(pos).some((form) => FORM_LABELS[form] === payload.prompt)
  );
}

/** EX-11: the item's character, by its key. */
function strokeTrace(payload: Payload, item: Item): boolean {
  const character = drawnCharacter(item);
  return !!character && same(payload, { itemKey: item.key, character });
}

/** EX-12: the kanji, asked by its primary meaning. */
function drawMemory(payload: Payload, item: Item): boolean {
  const kanji = item.type === 'kanji' ? kanjiDataSchema.safeParse(effective(item)).data : undefined;
  return (
    !!kanji &&
    same(payload, {
      itemKey: item.key,
      character: kanji.character,
      prompt: `Draw the kanji that means “${kanji.meanings[0]!}”.`,
    })
  );
}

const checks: Record<string, (payload: Payload, item: Item, content: PinContent) => boolean> = {
  [CHOICE_TYPE]: choice,
  [MATCH_PAIRS_TYPE]: matchPairs,
  [WORD_BANK_TYPE]: wordBank,
  [TYPED_ANSWER_TYPE]: typedAnswer,
  [READING_IN_CONTEXT_TYPE]: readingInContext,
  [CONJUGATE_TYPE]: conjugate,
  [STROKE_TRACE_TYPE]: strokeTrace,
  [DRAW_MEMORY_TYPE]: drawMemory,
};

/**
 * #259: whether the generator of the exercise's type could still ask its question about `item`.
 * A type this plugin has no check for answers true, so its pins are never marked detached.
 */
// shortcut: a new generator without a check here never marks its pins; add one with each
// generator (regenerates.test.ts fails for a generator whose exercises do not pass).
export function regenerates(exercise: Exercise, item: Item, content: PinContent): boolean {
  const check = Object.hasOwn(checks, exercise.type) ? checks[exercise.type]! : undefined;
  if (!check) return true;
  if (!isObject(exercise.payload)) return false;
  const payload = { ...exercise.payload };
  delete payload.accept;
  return check(payload, item, content);
}

import { LONG_TEXT, z } from '@manabi/core';

/**
 * DR-06: Japanese item `data` schemas, keyed by item type. The item envelope (key, type, level,
 * overrides, source) is language-neutral and lives in @manabi/core; these are the
 * language-specific fields inside `items.data`. Fields come from Product Spec sections 5 and 6
 * and the datasets in SDD section 10 (KANJIDIC2, JMdict); the importer issues may add fields.
 */

const text = z.string().min(1);
const hiragana = /^[ぁ-ゟー]+$/u;
const katakana = /^[゠-ヿ]+$/u;
/** Kana, plus '.' marking okurigana and '-' marking a prefix or suffix (KANJIDIC2 style). */
const kanaReading = /^[-.ぁ-ゟ゠-ヿ]+$/u;

/** One hiragana or katakana character (or digraph such as きゃ) and its romaji. */
export const kanaDataSchema = z
  .object({
    character: text.max(3),
    script: z.enum(['hiragana', 'katakana']),
    romaji: z.string().regex(/^[a-z-]+$/),
  })
  .strict()
  .refine((kana) => (kana.script === 'hiragana' ? hiragana : katakana).test(kana.character), {
    message: 'Character does not match its script',
    path: ['character'],
  });
export type KanaData = z.infer<typeof kanaDataSchema>;

/** A kanji: meanings (primary first), on and kun readings, stroke count and components. */
export const kanjiDataSchema = z
  .object({
    character: z.string().refine((value) => [...value].length === 1, 'Expected one kanji'),
    meanings: z.array(text).min(1),
    onReadings: z.array(z.string().regex(kanaReading)),
    kunReadings: z.array(z.string().regex(kanaReading)),
    strokeCount: z.number().int().min(1),
    /**
     * Radical and component characters as imported (raw list). The `item_links` rows of kind
     * `component` are authoritative for links between course items.
     */
    components: z.array(text).default([]),
  })
  .strict();
export type KanjiData = z.infer<typeof kanjiDataSchema>;

/**
 * A word: written form, kana reading and its senses, primary first. Each sense has its English
 * meanings and its part-of-speech codes as JMdict writes them (`v5u`, `adj-i`).
 */
export const wordDataSchema = z
  .object({
    written: text,
    reading: z.string().regex(kanaReading),
    senses: z
      .array(
        z
          .object({ partsOfSpeech: z.array(text).default([]), meanings: z.array(text).min(1) })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type WordData = z.infer<typeof wordDataSchema>;

/** One formation row: a word type, its form and a worked example (Product Spec section 6). */
export const formationRowSchema = z.object({ wordType: text, form: text, example: text }).strict();

/**
 * FR-236: one detection pattern, a run of consecutive kuromoji-ipadic tokens. Each matcher names
 * the token's surface, base form and/or leading part-of-speech tags, e.g.
 * `[{ base: て }, { base: おく, pos: [動詞, 非自立] }]`.
 */
export const detectionPatternSchema = z
  .array(
    z
      .object({
        surface: text.optional(),
        base: text.optional(),
        pos: z.array(text).min(1).optional(),
      })
      .strict()
      .refine((m) => Object.keys(m).length > 0, 'A matcher needs surface, base or pos'),
  )
  .min(1);

/**
 * A grammar point. A stub has only its pattern (and level, on the item envelope) until its page is
 * written (SDD section 4), so every other field is optional.
 */
export const grammarDataSchema = z
  .object({
    pattern: text,
    meaning: text.optional(),
    /** Grammar reference themes such as 'particles' or 'verb forms'. */
    themes: z.array(text).default([]),
    formation: z.array(formationRowSchema).default([]),
    /** Markdown body: explanation paragraphs. */
    explanation: text.describe(LONG_TEXT).optional(),
    /** FR-236: the point is detected in a sentence when any one pattern matches. */
    detection: z.array(detectionPatternSchema).default([]),
  })
  .strict();
export type GrammarData = z.infer<typeof grammarDataSchema>;

export const itemSchemas = {
  kana: kanaDataSchema,
  kanji: kanjiDataSchema,
  word: wordDataSchema,
  grammar: grammarDataSchema,
};

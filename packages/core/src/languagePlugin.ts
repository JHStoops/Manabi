import type { ZodTypeAny } from 'zod';
import type { Item } from './content';

// NOTE: Several types below are placeholders. They will be replaced by the real
// domain types (exercises, learner state) as the corresponding features land.

/** Placeholder for an exercise presented to the learner. */
export type Exercise = { id: string; type: string; prompt: unknown; accepted: unknown };

/** Placeholder for context passed to answer normalization (exercise, locale, settings). */
export type AnswerContext = { exercise?: Exercise; [key: string]: unknown };

/** Placeholder for an exercise generator; produces exercises for an item. */
export type ExerciseGenerator = (item: Item, context: unknown) => Exercise[];

/** A review facet is one independently scheduled way of recalling an item (e.g. "reading"). */
export type ReviewFacet = string;

/** How raw keyboard input should be converted (e.g. romaji to kana). */
export type InputMode = string;

/** A token produced by `tokenize`: a slice of the original sentence. */
export type Token = { surface: string; start: number; end: number };

/** Placeholder for an annotation attached to a span of a sentence (e.g. furigana). */
export type Annotation = { start: number; end: number; kind: string; value: string };

/** Result of checking an answer. */
export type CheckResult =
  { result: 'correct' } | { result: 'near-miss'; hint: string } | { result: 'wrong' };

/** Which optional learner-facing features a language supports. */
export interface LanguageFeatures {
  /** Character-level study (e.g. kana, kanji). */
  characterStudy: boolean;
  /** Stroke order drawing practice. */
  strokeDrawing: boolean;
  /** Reading annotations such as furigana. */
  readingAnnotations: boolean;
  /** Converting typed input (e.g. romaji to kana). */
  inputConversion: boolean;
}

/** Placeholder for the text-to-speech voice selection for a language. */
export type TtsVoice = { locale: string; voice?: string };

/**
 * Everything language-specific lives behind this interface. Plugins are pure TypeScript:
 * no Node or browser APIs, so they run unchanged on the server and in the browser.
 */
export interface LanguagePlugin {
  /** Language code, e.g. "ja". */
  code: string;
  /** Human-readable name, e.g. "Japanese". */
  name: string;
  /** Writing systems used, e.g. ["hiragana", "katakana", "kanji"]. */
  scripts: string[];
  /** Optional features this language supports. */
  features: LanguageFeatures;
  /** Zod schemas for language-specific item types, keyed by item type. */
  itemSchemas: Record<string, ZodTypeAny>;
  /** Normalizes a typed answer before comparison (width, case, script, whitespace). */
  normalizeAnswer(text: string, context: AnswerContext): string;
  /** Checks a learner's answer: correct, near-miss with a hint, or wrong. */
  checkAnswer(given: string, exercise: Exercise): CheckResult;
  /** Converts raw input for the given input mode (e.g. romaji to kana). */
  convertInput(text: string, mode: InputMode): string;
  /** Splits a sentence into tokens. */
  tokenize(sentence: string): Token[];
  /** Annotates a sentence, taking the learner's learned items into account. */
  annotate(sentence: string, learnedItems: Item[]): Annotation[];
  /** Exercise generators keyed by name. */
  generators: Record<string, ExerciseGenerator>;
  /** The review facets scheduled independently for an item type. */
  reviewFacets(itemType: string): ReviewFacet[];
  /** Preferred text-to-speech voice for this language. */
  ttsVoice: TtsVoice;
}

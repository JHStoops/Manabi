import type { ZodTypeAny } from 'zod';
import type { Course, Item } from './content';
import type { Tile } from './sentence';

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

/** Placeholder for an annotation attached to a span of a sentence (e.g. furigana). */
export type Annotation = { start: number; end: number; kind: string; value: string };

/** Result of checking an answer. */
export type CheckResult =
  { result: 'correct' } | { result: 'near-miss'; hint: string } | { result: 'wrong' };

/** Which optional learner-facing features a language supports (FR-241). */
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

/** One writing system of a language (SDD section 4). */
export interface ScriptInfo {
  /** Script id, e.g. "hiragana" or "kanji". */
  id: string;
  /** Whether words in this script can carry readings shown above the text (furigana). */
  readingsAbove: boolean;
}

/**
 * FR-136: how audio is generated for this language. `input` says which text the engine is sent:
 * the item's or sentence's reading (a sentence's reading is its stored tiles' readings joined),
 * or its written form.
 */
export interface TtsVoice {
  /** TtsProvider adapter id, e.g. "kokoro". */
  provider: string;
  /** Provider voice id, e.g. "jf_alpha". */
  voice: string;
  /** Provider-specific language option (Kokoro's `lang_code`), if the provider needs one. */
  providerLanguage?: string;
  /** BCP 47 locale for the browser speechSynthesis fallback, e.g. "ja-JP". */
  locale: string;
  /** Which text to send to the engine. */
  input: 'reading' | 'written';
}

/** Id of a Node-only morphological analyzer adapter in packages/importers, e.g. "kuromoji-ipadic". */
export type AnalyzerId = string;

/**
 * One token from a morphological analyzer, in a language-neutral shape (FR-238). The analyzer
 * adapter (packages/importers) maps its native output to this; for kuromoji-ipadic:
 * `surface_form`, `pos` plus `pos_detail_1..3`, `conjugated_type`, `conjugated_form`,
 * `basic_form`, `reading`. Fields the analyzer leaves empty (kuromoji's "*") become null.
 */
export interface AnalyzerToken {
  /** The text exactly as it appears in the input. */
  surface: string;
  /** Part-of-speech tags from most general to most specific, e.g. ["名詞", "固有名詞", "地域"]. */
  pos: readonly string[];
  /** Conjugation (inflection) class, e.g. "一段"; null for words that do not inflect. */
  conjugationType: string | null;
  /** Conjugated form of this token, e.g. "連用形"; null for words that do not inflect. */
  conjugationForm: string | null;
  /** Dictionary (base) form, e.g. 食べ → 食べる; null when unknown to the analyzer. */
  baseForm: string | null;
  /** Reading in the analyzer's script (katakana for kuromoji); null when unknown. */
  reading: string | null;
}

/**
 * A grammar point as `detectGrammar` sees it: its stable key and the detection patterns from its
 * front matter (SDD section 4, FR-236).
 */
export interface GrammarPointPatterns {
  key: string;
  // PLACEHOLDER: the pattern shape over analyzer tokens is defined with detectGrammar (#110).
  detection: readonly unknown[];
}

/** Text whose tiles `tokenize` returns: a sentence, or authored answer text, and its stored tiles. */
export interface TokenizeInput {
  text: string;
  /** Tiles stored with the text (DR-12); absent, null or empty when none are stored. */
  tiles?: readonly Tile[] | null;
}

/**
 * Everything language-specific lives behind this interface (FR-240, FR-242, SDD section 4).
 * Plugins are pure TypeScript: no Node or browser APIs, so they run unchanged on the server and
 * in the browser.
 */
export interface LanguagePlugin {
  /** Language code, e.g. "ja". The registry key; a course names its plugin by this code. */
  code: string;
  /** Human-readable name, e.g. "Japanese". */
  name: string;
  /** Writing systems used, and whether each has readings shown above text. */
  scripts: readonly ScriptInfo[];
  /** Optional features this language supports (FR-241). */
  features: LanguageFeatures;
  /** Zod schemas for language-specific item `data`, keyed by item type (DR-06). */
  itemSchemas: Record<string, ZodTypeAny>;
  /** Normalizes a typed answer before comparison (kana folding, width, case, punctuation). */
  normalizeAnswer(text: string, context: AnswerContext): string;
  /** Checks a learner's answer: correct, near-miss with a hint, or wrong. */
  checkAnswer(given: string, exercise: Exercise): CheckResult;
  /** Converts raw input for the given input mode (e.g. romaji to kana). */
  convertInput(text: string, mode: InputMode): string;
  /**
   * The tappable words and word-bank tiles of a sentence or answer text: its stored tiles. Only
   * when none are stored, a simple fallback split (SDD section 4).
   */
  tokenize(input: TokenizeInput): Tile[];
  /** Annotates a sentence, taking the learner's learned items into account. */
  annotate(sentence: string, learnedItems: Item[]): Annotation[];
  /** Exercise generators keyed by exercise type. */
  generators: Record<string, ExerciseGenerator>;
  /** The review facets scheduled independently for an item type. */
  reviewFacets(itemType: string): ReviewFacet[];
  /** Text-to-speech provider, voice and which text to send (FR-136). */
  ttsVoice: TtsVoice;
  /**
   * FR-238: the Node-only analyzer adapter `segment` and `detectGrammar` consume, or null for
   * languages split on spaces. The plugin never imports the analyzer itself.
   */
  analyzer: AnalyzerId | null;
  /** FR-238: pure function from analyzer tokens to tiles (surface, base form, reading). */
  segment(tokens: readonly AnalyzerToken[]): Tile[];
  /** FR-236: keys of the given grammar points whose detection patterns match the tokens. */
  detectGrammar(
    tokens: readonly AnalyzerToken[],
    points: readonly GrammarPointPatterns[],
  ): string[];
}

/** Thrown when no language plugin is registered under a code. */
export class UnknownLanguagePluginError extends Error {
  constructor(readonly code: string) {
    super(`No language plugin is registered for "${code}"`);
    this.name = 'UnknownLanguagePluginError';
  }
}

/** Thrown when two plugins are registered under the same code. */
export class DuplicateLanguagePluginError extends Error {
  constructor(readonly code: string) {
    super(`A language plugin is already registered for "${code}"`);
    this.name = 'DuplicateLanguagePluginError';
  }
}

/** The one map of language plugins, keyed by language code (SDD section 4). */
export interface LanguagePluginRegistry {
  /** The plugin registered under `code`; throws UnknownLanguagePluginError if there is none. */
  get(code: string): LanguagePlugin;
  /** The plugin a course names in its `plugin` field. */
  forCourse(course: Pick<Course, 'plugin'>): LanguagePlugin;
  has(code: string): boolean;
  /** Registered codes, in registration order. */
  codes(): string[];
}

/**
 * Builds the registry from the plugins an app ships. Apps own the list (packages never depend on
 * each other's plugins), so adding a language is one entry there (FR-242).
 */
export function createLanguagePluginRegistry(
  plugins: readonly LanguagePlugin[],
): LanguagePluginRegistry {
  const byCode = new Map<string, LanguagePlugin>();
  for (const plugin of plugins) {
    if (byCode.has(plugin.code)) throw new DuplicateLanguagePluginError(plugin.code);
    byCode.set(plugin.code, plugin);
  }
  const get = (code: string): LanguagePlugin => {
    const plugin = byCode.get(code);
    if (!plugin) throw new UnknownLanguagePluginError(code);
    return plugin;
  };
  return {
    get,
    forCourse: (course) => get(course.plugin),
    has: (code) => byCode.has(code),
    codes: () => [...byCode.keys()],
  };
}

import type { ZodTypeAny } from 'zod';
import type { Course, Item } from './content';
import type { Exercise } from './exerciseRegistry';
import type { AnswerText, Sentence, Tile } from './sentence';
import type { ReadingAnnotationMode } from './settings';

// NOTE: Several types below are placeholders. They will be replaced by the real
// domain types (learner state) as the corresponding features land.

/** Placeholder for context passed to answer normalization (exercise, locale, settings). */
export type AnswerContext = { exercise?: Exercise; [key: string]: unknown };

/** A sentence as generators see it. */
export type GeneratorSentence = Pick<
  Sentence,
  'id' | 'text' | 'tokens' | 'translation' | 'grammar'
>;

/** What a generator may draw on when building a lesson session (SDD section 6). */
export interface GeneratorContext {
  /** Level code of the lesson's section. */
  sectionLevel: string;
  /** FR-048: the items taught in this and earlier lessons; distractors come only from these. */
  taughtItems: readonly Item[];
  /** FR-056: sentences at or below the section's level, not challenging, of taught items only. */
  sentences: readonly GeneratorSentence[];
  /**
   * The review facet (see `reviewFacets`) the exercise should test, when the caller needs one:
   * a review of that facet, or a lesson step (Product Spec section 5: a kanji's meaning, then its
   * reading). Absent: the generator picks.
   */
  facet?: ReviewFacet;
}

/** An exercise generator: builds exercises of one type for an item (FR-049). */
export type ExerciseGenerator = (item: Item, context: GeneratorContext) => Exercise[];

/**
 * Product Spec section 4: what a teaching card shows for an item: the item itself, its reading
 * and its meaning, each null when the item has none to show.
 */
export interface TeachingCardFields {
  term: string;
  reading: string | null;
  meaning: string | null;
  /** FR-135, FR-136: the text the speaker button sends to TTS (Japanese: the kana reading). */
  spoken: string;
  /** Product Spec section 6: a grammar point's formation table; absent for other items. */
  formation?: readonly { wordType: string; form: string; example: string }[];
}

/** A review facet is one independently scheduled way of recalling an item (e.g. "reading"). */
export type ReviewFacet = string;

/** How raw keyboard input should be converted (e.g. romaji to kana). */
export type InputMode = string;

/**
 * An annotation attached to a span of a sentence (e.g. furigana). `start` and
 * `end` are UTF-16 code-unit offsets into the tiles' surfaces joined (end exclusive).
 */
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
 * `basic_form`, `reading`. Fields the analyzer leaves empty (kuromoji's "*") become null, and
 * kuromoji's "*" POS details are left out, so `pos` may have fewer than 4 tags.
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
 * FR-236: matches one analyzer token. Every given field must match: `surface` and `base` exactly
 * (`base` against `baseForm`), `pos` as a prefix of the token's tags. At least one field is given.
 */
export interface TokenMatcher {
  surface?: string;
  base?: string;
  pos?: readonly string[];
}

/** FR-236: a run of consecutive tokens, one matcher per token. */
export type DetectionPattern = readonly TokenMatcher[];

/**
 * A grammar point as `detectGrammar` sees it: its stable key and the detection patterns from its
 * front matter (SDD section 4, FR-236). The point is detected when any one pattern matches.
 */
export interface GrammarPointPatterns {
  key: string;
  detection: readonly DetectionPattern[];
}

/**
 * A tile from `segment`. Only the Tile part is stored; `counted` says whether the tile counts
 * toward the sentence's vocabulary level in the coverage check (FR-235: particles, auxiliaries,
 * numbers, counters and names do not). Deciding that is language knowledge (FR-240).
 */
export type SegmentedTile = Tile & { counted: boolean };

/** Text whose tiles `tokenize` returns: a sentence, or authored answer text, and its stored tiles. */
export interface TokenizeInput {
  text: string;
  /** Tiles stored with the text (DR-12); absent, null or empty when none are stored. */
  tiles?: readonly Tile[] | null;
}

/** FR-075, FR-092: an item's library search terms (each passed through `searchKey`) and filters. */
export interface LibraryFields {
  terms: string[];
  strokeCount: number | null;
  radical: string | null;
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
  /**
   * Checks a learner's typed answer against an exercise's accept list: correct, near-miss with a
   * hint, or wrong. `testsKanji`: only the written (kanji) form of an answer is accepted.
   */
  checkAnswer(given: string, accept: readonly AnswerText[], testsKanji: boolean): CheckResult;
  /** Converts raw input for the given input mode (e.g. romaji to kana). */
  convertInput(text: string, mode: InputMode): string;
  /**
   * The tappable words and word-bank tiles of a sentence or answer text: its stored tiles,
   * unchanged. Only when none are stored, a simple fallback split (SDD section 4) whose base form
   * and reading are just the surface, so fallback tiles are never used for audio or furigana.
   */
  tokenize(input: TokenizeInput): Tile[];
  /**
   * FR-140: reading annotations (furigana) for a sentence's stored tiles in the learner's mode.
   * `learnedItems`: the learner's items at stage 4 or above, which `unlearned` mode leaves bare.
   * Offsets are into the tiles' surfaces joined.
   */
  annotate(tiles: readonly Tile[], learnedItems: Item[], mode: ReadingAnnotationMode): Annotation[];
  /** The teaching-card fields of an item in a section at `sectionLevel` (FR-041, FR-141). */
  teachingCard(item: Item, sectionLevel: string): TeachingCardFields;
  /** Exercise generators keyed by exercise type. */
  generators: Record<string, ExerciseGenerator>;
  /**
   * FR-110, SDD section 6: the review facets of an item type, each with the exercise types (in
   * order of preference) that review it. An item type with no facets never enters reviews.
   */
  reviewFacets(itemType: string): Record<ReviewFacet, readonly string[]>;
  /**
   * FR-075, FR-092: what the library searches and filters an item by, from its merged data. The
   * API stores the result on the item at every write. Invalid data gives no terms.
   */
  libraryFields(item: { type: string; data: unknown }): LibraryFields;
  /** Folds search text so a query compares equal to the terms `libraryFields` returns. */
  searchKey(text: string): string;
  /** Text-to-speech provider, voice and which text to send (FR-136). */
  ttsVoice: TtsVoice;
  /** FR-136: the reading sent to TTS for these tiles (Japanese: readings joined, no spaces). */
  readingOf(tiles: readonly Tile[]): string;
  /**
   * FR-238: the Node-only analyzer adapter whose tokens `segment` and `detectGrammar` consume.
   * null: the importers' generic whitespace adapter supplies tokens (pos empty, baseForm/reading
   * null). The plugin never imports the analyzer itself.
   */
  analyzer: AnalyzerId | null;
  /**
   * FR-238: pure function from analyzer tokens to tiles (surface, base form, reading), each marked
   * whether it counts toward the vocabulary level (FR-235).
   */
  segment(tokens: readonly AnalyzerToken[]): SegmentedTile[];
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

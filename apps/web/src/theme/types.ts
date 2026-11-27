/** One theme variant (SDD section 9): colors, lesson-type colors, spacing, radii and type scale. */
export interface ManabiTheme {
  name: string;
  mode: 'light' | 'dark';
  colors: {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryText: string;
    border: string;
    /** Answer feedback (FR-046); NFR-31: always shown with an icon and text too. */
    correct: string;
    tryAgain: string;
    wrong: string;
  };
  /** Each lesson type keeps its color in every theme (Product Spec section 10). */
  lessonColors: {
    vocabulary: string;
    kanji: string;
    grammar: string;
    listening: string;
    review: string;
  };
  /**
   * FR-102: the stage ring's color per stage band, the same in every theme. NFR-31: the ring's fill
   * and the stage name in text carry the stage too, so color is never the only cue.
   */
  stageColors: {
    learning: string;
    familiar: string;
    strong: string;
    mastered: string;
    retired: string;
  };
  /** Path section color bands, cycled in section order; kana lessons take their section's color. */
  sectionColors: string[];
  spacing: (units: number) => string;
  radii: { small: string; medium: string; pill: string };
  fontSizes: { small: string; body: string; title: string; display: string };
}

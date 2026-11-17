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
  };
  /** Each lesson type keeps its color in every theme (Product Spec section 10). */
  lessonColors: {
    vocabulary: string;
    kanji: string;
    grammar: string;
    listening: string;
    review: string;
  };
  spacing: (units: number) => string;
  radii: { small: string; medium: string; pill: string };
  fontSizes: { small: string; body: string; title: string; display: string };
}

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
  spacing: (units: number) => string;
  radius: string;
}

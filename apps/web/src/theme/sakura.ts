import type { ManabiTheme } from './types';

// PLACEHOLDER palette; real design tokens come later.
export const spacing = (units: number): string => `${units * 4}px`;
export const radii = { small: '8px', medium: '16px', pill: '999px' };
export const fontSizes = { small: '0.875rem', body: '1rem', title: '1.5rem', display: '2rem' };
export const lessonColors = {
  vocabulary: '#2f7de1',
  kanji: '#8a4fd8',
  grammar: '#2e9d5b',
  listening: '#e8822a',
  review: '#d4a017',
};
// Mid-tones: at least 3:1 against every theme's surface, light and dark (WCAG 1.4.11).
export const stageColors = {
  learning: '#e0245e',
  familiar: '#ab47bc',
  strong: '#2a7fd4',
  mastered: '#388e3c',
  retired: '#7a7a7a',
};
// Sakura's path bands: blossom, plum, beni red, wisteria, bark. Band titles pick black or white
// text by contrast (WCAG AA); each theme has its own set in themes.ts.
export const sectionColors = ['#b0306a', '#8a3f88', '#a3384f', '#6b4a96', '#86503a'];
// Lighter on dark pages, for 3:1 against the background (WCAG 1.4.11).
export const darkSectionColors = ['#e0679a', '#c27ac0', '#e07a8a', '#a48ad6', '#c8906e'];

export const sakuraLight: ManabiTheme = {
  name: 'sakura',
  mode: 'light',
  colors: {
    background: '#fff8fa',
    surface: '#ffffff',
    text: '#2b1d22',
    textMuted: '#6e5a62',
    primary: '#c2185b',
    primaryText: '#ffffff',
    border: '#f0d5de',
    correct: '#2e7d32',
    tryAgain: '#a15c00',
    wrong: '#c62828',
  },
  lessonColors,
  stageColors,
  sectionColors,
  spacing,
  radii,
  fontSizes,
};

export const sakuraDark: ManabiTheme = {
  name: 'sakura',
  mode: 'dark',
  colors: {
    background: '#1c1317',
    surface: '#271b21',
    text: '#f6e9ee',
    textMuted: '#b8a0aa',
    primary: '#f08cb0',
    primaryText: '#1c1317',
    border: '#3d2a33',
    correct: '#66bb6a',
    tryAgain: '#ffb74d',
    wrong: '#ef5350',
  },
  lessonColors,
  stageColors,
  sectionColors: darkSectionColors,
  spacing,
  radii,
  fontSizes,
};

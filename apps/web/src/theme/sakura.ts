import type { ManabiTheme } from './types';

// PLACEHOLDER palette; real design tokens come later.
const spacing = (units: number): string => `${units * 4}px`;
const radii = { small: '8px', medium: '16px', pill: '999px' };
const fontSizes = { small: '0.875rem', body: '1rem', title: '1.5rem', display: '2rem' };
const lessonColors = {
  vocabulary: '#2f7de1',
  kanji: '#8a4fd8',
  grammar: '#2e9d5b',
  listening: '#e8822a',
  review: '#d4a017',
};

export const sakuraLight: ManabiTheme = {
  name: 'sakura',
  mode: 'light',
  colors: {
    background: '#fff8fa',
    surface: '#ffffff',
    text: '#2b1d22',
    textMuted: '#6e5a62',
    primary: '#d6457a',
    primaryText: '#ffffff',
    border: '#f0d5de',
  },
  lessonColors,
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
  },
  lessonColors,
  spacing,
  radii,
  fontSizes,
};

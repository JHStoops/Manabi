import type { ManabiTheme } from './types';

// PLACEHOLDER palette; real design tokens come later.
const spacing = (units: number): string => `${units * 4}px`;

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
  spacing,
  radius: '8px',
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
  spacing,
  radius: '8px',
};

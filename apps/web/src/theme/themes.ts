import type { ColorMode, Theme as ThemeName } from '@manabi/core';
import {
  fontSizes,
  lessonColors,
  radii,
  sakuraDark,
  sakuraLight,
  spacing,
  stageColors,
} from './sakura';
import type { ManabiTheme } from './types';

// FR-166, Product Spec section 10. Palettes are the five themes' own colors; the feedback colors
// and lesson-type colors are shared so their meaning never changes (NFR-31).
type Palette = Omit<ManabiTheme['colors'], 'correct' | 'tryAgain' | 'wrong'>;

const palettes: Record<Exclude<ThemeName, 'sakura'>, { light: Palette; dark: Palette }> = {
  // Whisked tea: a yellow-leaning leaf green on pale tea, not a generic UI green.
  matcha: {
    light: {
      background: '#f3f5e9',
      surface: '#ffffff',
      text: '#1e2614',
      textMuted: '#535e45',
      primary: '#4d6b1f',
      primaryText: '#ffffff',
      border: '#dce3c6',
    },
    dark: {
      background: '#13170e',
      surface: '#1c2215',
      text: '#edf2e0',
      textMuted: '#a8b392',
      primary: '#a9c96e',
      primaryText: '#13170e',
      border: '#2e3724',
    },
  },
  // Open sea: blue with a teal lean, on a pale water tint.
  umi: {
    light: {
      background: '#eef6f9',
      surface: '#ffffff',
      text: '#0d2430',
      textMuted: '#43606c',
      primary: '#006690',
      primaryText: '#ffffff',
      border: '#c9e0e9',
    },
    dark: {
      background: '#08171f',
      surface: '#0f222c',
      text: '#e2f1f7',
      textMuted: '#90b0bd',
      primary: '#5ec2e8',
      primaryText: '#08171f',
      border: '#1d3946',
    },
  },
  yuyake: {
    light: {
      background: '#fff4ea',
      surface: '#ffffff',
      text: '#2e170c',
      textMuted: '#6d4a38',
      primary: '#c03f00',
      primaryText: '#ffffff',
      border: '#f5d3bb',
    },
    dark: {
      background: '#1d120d',
      surface: '#2a1a12',
      text: '#fcebdf',
      textMuted: '#c9a690',
      primary: '#ff9550',
      primaryText: '#1d120d',
      border: '#47301f',
    },
  },
  sumi: {
    light: {
      background: '#ffffff',
      surface: '#ffffff',
      text: '#000000',
      textMuted: '#3d3d3d',
      primary: '#000000',
      primaryText: '#ffffff',
      border: '#595959',
    },
    dark: {
      background: '#000000',
      surface: '#111111',
      text: '#ffffff',
      textMuted: '#c8c8c8',
      primary: '#ffffff',
      primaryText: '#000000',
      border: '#bfbfbf',
    },
  },
};

// Path section bands in each theme's own family, so the path itself reads as the theme.
// Dark pages get lighter bands, for 3:1 against the background (WCAG 1.4.11); titles pick black
// or white text. Sumi stays ink: dark grays on paper, light grays on black.
const bands: Record<Exclude<ThemeName, 'sakura'>, { light: string[]; dark: string[] }> = {
  matcha: {
    light: ['#3f6b22', '#5e6a1c', '#1f6a4e', '#6e5530', '#46613a'],
    dark: ['#86b95a', '#b0b54a', '#5fbf98', '#c4a46a', '#8fb07e'],
  },
  umi: {
    light: ['#00668f', '#00707a', '#2d55a0', '#1b6563', '#41608c'],
    dark: ['#4fb3e0', '#3fc1c9', '#7f9ff0', '#5cc2b8', '#8fa9d6'],
  },
  yuyake: {
    light: ['#b83a0b', '#b4232a', '#9c3d12', '#a3305f', '#7b3a96'],
    dark: ['#f2884a', '#f0706a', '#e0a050', '#e57aa3', '#b88ae0'],
  },
  sumi: {
    light: ['#000000', '#3d3d3d', '#262626', '#525252', '#141414'],
    dark: ['#ffffff', '#c8c8c8', '#e6e6e6', '#a8a8a8', '#d6d6d6'],
  },
};

function build(name: ThemeName, mode: 'light' | 'dark'): ManabiTheme {
  const base = mode === 'light' ? sakuraLight : sakuraDark;
  if (name === 'sakura') return base;
  return {
    name,
    mode,
    colors: { ...base.colors, ...palettes[name][mode] },
    lessonColors,
    stageColors,
    sectionColors: bands[name][mode],
    spacing,
    radii,
    fontSizes,
  };
}

/** All ten theme objects. */
export const themes: ManabiTheme[] = (
  ['sakura', 'matcha', 'umi', 'yuyake', 'sumi'] as const
).flatMap((name) => [build(name, 'light'), build(name, 'dark')]);

/** The theme for a setting; `system` follows the device's preference. */
export function themeFor(name: ThemeName, colorMode: ColorMode, systemDark: boolean): ManabiTheme {
  const dark = colorMode === 'system' ? systemDark : colorMode === 'dark';
  return themes.find((t) => t.name === name && t.mode === (dark ? 'dark' : 'light'))!;
}

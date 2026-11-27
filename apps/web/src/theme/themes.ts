import type { ColorMode, Theme as ThemeName } from '@manabi/core';
import {
  fontSizes,
  lessonColors,
  radii,
  sakuraDark,
  sakuraLight,
  sectionColors,
  spacing,
  stageColors,
} from './sakura';
import type { ManabiTheme } from './types';

// FR-166, Product Spec section 10. Palettes are the five themes' own colors; the feedback colors
// and lesson-type colors are shared so their meaning never changes (NFR-31).
type Palette = Omit<ManabiTheme['colors'], 'correct' | 'tryAgain' | 'wrong'>;

const palettes: Record<Exclude<ThemeName, 'sakura'>, { light: Palette; dark: Palette }> = {
  matcha: {
    light: {
      background: '#f4f9f1',
      surface: '#ffffff',
      text: '#1c2a1e',
      textMuted: '#4d5f4f',
      primary: '#2e7d32',
      primaryText: '#ffffff',
      border: '#d3e5cf',
    },
    dark: {
      background: '#121a14',
      surface: '#1b261d',
      text: '#e8f3e6',
      textMuted: '#a3b8a5',
      primary: '#7fcf84',
      primaryText: '#0f1a11',
      border: '#2c3d2f',
    },
  },
  umi: {
    light: {
      background: '#f2f8fd',
      surface: '#ffffff',
      text: '#14232f',
      textMuted: '#4a6070',
      primary: '#1565c0',
      primaryText: '#ffffff',
      border: '#cfe1f0',
    },
    dark: {
      background: '#0f1a24',
      surface: '#172531',
      text: '#e6f1fa',
      textMuted: '#9db4c6',
      primary: '#6fb4f0',
      primaryText: '#0b1620',
      border: '#28394a',
    },
  },
  yuyake: {
    light: {
      background: '#fff7f0',
      surface: '#ffffff',
      text: '#2d1a10',
      textMuted: '#6b4f40',
      primary: '#bf4a00',
      primaryText: '#ffffff',
      border: '#f3d9c6',
    },
    dark: {
      background: '#1e140e',
      surface: '#2a1d14',
      text: '#fbece0',
      textMuted: '#c4a894',
      primary: '#ff9a52',
      primaryText: '#1e140e',
      border: '#46301f',
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

function build(name: ThemeName, mode: 'light' | 'dark'): ManabiTheme {
  const base = mode === 'light' ? sakuraLight : sakuraDark;
  if (name === 'sakura') return base;
  return {
    name,
    mode,
    colors: { ...base.colors, ...palettes[name][mode] },
    lessonColors,
    stageColors,
    sectionColors,
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

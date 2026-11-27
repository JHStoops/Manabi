import { themeSchema } from '@manabi/core';
import { contrastRatio } from './contrast';
import { themeFor, themes } from './themes';

// FR-166, NFR-30, NFR-31: every theme in both modes.
describe('themes', () => {
  it('has a light and a dark variant of each of the five themes', () => {
    expect(themes).toHaveLength(10);
    for (const name of themeSchema.options) {
      expect(
        themes
          .filter((t) => t.name === name)
          .map((t) => t.mode)
          .sort(),
      ).toEqual(['dark', 'light']);
    }
  });

  it.each(themes.map((t) => [`${t.name} ${t.mode}`, t] as const))(
    '%s meets WCAG AA for text and controls',
    (_label, { colors }) => {
      const pairs: [string, string][] = [
        [colors.text, colors.background],
        [colors.text, colors.surface],
        [colors.textMuted, colors.background],
        [colors.textMuted, colors.surface],
        [colors.primaryText, colors.primary],
        [colors.primary, colors.background],
        [colors.primary, colors.surface],
      ];
      for (const [fg, bg] of pairs) {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
      }
      for (const color of [colors.correct, colors.tryAgain, colors.wrong]) {
        expect(contrastRatio(colors.surface, color)).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it('keeps lesson-type colors the same in every theme', () => {
    for (const t of themes) expect(t.lessonColors).toEqual(themes[0]!.lessonColors);
  });

  // FR-102, WCAG 1.4.11: the stage ring stands out from the tile in every theme.
  it.each(themes.map((t) => [`${t.name} ${t.mode}`, t] as const))(
    '%s shows every stage ring color at 3:1 or more on the surface',
    (_label, { colors, stageColors }) => {
      for (const color of Object.values(stageColors)) {
        expect(contrastRatio(color, colors.surface)).toBeGreaterThanOrEqual(3);
      }
      expect(stageColors).toEqual(themes[0]!.stageColors);
    },
  );

  it('follows the device only for the system color mode', () => {
    expect(themeFor('umi', 'system', true).mode).toBe('dark');
    expect(themeFor('umi', 'system', false).mode).toBe('light');
    expect(themeFor('umi', 'light', true).mode).toBe('light');
  });
});

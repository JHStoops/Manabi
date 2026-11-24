import { contrastRatio, readableOn } from './contrast';
import { sakuraDark, sakuraLight } from './sakura';

const ink = sakuraLight.colors.text;

describe('readableOn', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
    expect(contrastRatio('#ffffff', '#e8822a')).toBeCloseTo(2.74, 1);
  });

  it('picks dark ink on light lesson colors and white on dark ones', () => {
    expect(readableOn(sakuraLight.lessonColors.listening, '#ffffff', ink)).toBe(ink);
    expect(readableOn(sakuraLight.lessonColors.review, '#ffffff', ink)).toBe(ink);
    expect(readableOn(sakuraLight.lessonColors.kanji, '#ffffff', ink)).toBe('#ffffff');
  });

  it('gives every lesson and section color an icon color of at least 3:1', () => {
    for (const bg of [...Object.values(sakuraLight.lessonColors), ...sakuraLight.sectionColors]) {
      expect(contrastRatio(bg, readableOn(bg, '#ffffff', ink))).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives the feedback colors 3:1 on the surface in both modes (NFR-31 icons)', () => {
    for (const { colors } of [sakuraLight, sakuraDark]) {
      for (const color of [colors.correct, colors.tryAgain, colors.wrong]) {
        expect(contrastRatio(colors.surface, color)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

import { contrastRatio, readableOn } from './contrast';
import { sakuraLight } from './sakura';

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
});

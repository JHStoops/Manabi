import { render, screen } from '@testing-library/react';
import '../../i18n';
import { AppThemeProvider, sakuraLight } from '../../theme';
import { ItemTile } from './ItemTile';

// FR-102, NFR-31: the stage is text, not only a ring.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

const show = (stage: number | null, variant?: 'row' | 'grid') =>
  render(
    <AppThemeProvider>
      <ItemTile label="水" stage={stage as never} lang="ja" variant={variant} />
    </AppThemeProvider>,
  );

describe('ItemTile', () => {
  it.each([
    [null, 'Not started'],
    [1, 'Learning'],
    [3, 'Learning'],
    [4, 'Familiar'],
    [6, 'Strong'],
    [7, 'Mastered'],
    [8, 'Retired'],
  ])('shows stage %s as the text "%s"', (stage, name) => {
    for (const variant of ['row', 'grid'] as const) {
      const { unmount } = show(stage, variant);
      expect(screen.getByText(name)).toBeTruthy();
      expect(screen.getByText('水').getAttribute('lang')).toBe('ja');
      unmount();
    }
  });

  it("draws the ring in the stage band's color, filled stage/8", () => {
    const { container } = show(4, 'grid');
    const ring = container.querySelectorAll('circle')[1]!;
    expect(ring.getAttribute('stroke')).toBe(sakuraLight.stageColors.familiar);
    const circumference = 2 * Math.PI * 10;
    expect(ring.getAttribute('stroke-dasharray')).toBe(`${circumference / 2} ${circumference}`);
  });

  it('draws only the empty track for an item not started', () => {
    const { container } = show(null, 'grid');
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });
});

import { render, screen } from '@testing-library/react';
import '../../i18n';
import { AppThemeProvider } from '../../theme';
import { ItemTile } from './ItemTile';

// FR-102, NFR-31: the stage is text, not only a ring.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

const show = (stage: number | null) =>
  render(
    <AppThemeProvider>
      <ItemTile label="水" stage={stage as never} lang="ja" />
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
    show(stage);
    expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText('水').getAttribute('lang')).toBe('ja');
  });
});

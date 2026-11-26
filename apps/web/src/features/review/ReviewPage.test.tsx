import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import type { ReviewSummary } from '@manabi/core';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import ReviewPage from './ReviewPage';

// FR-113, NFR-31: the Review tab renders the summary and forecast from the API.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

const summary = (dueNow: number): ReviewSummary => ({
  dueNow,
  forecast: Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-${26 + (i % 5)}`, count: i })),
});

function show(body: ReviewSummary | Error) {
  const api = {
    GET: jest.fn(() => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body))),
  };
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>
        <MemoryRouter>
          <ReviewPage />
        </MemoryRouter>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
}

describe('ReviewPage', () => {
  it('shows the due count, a start link and a count for each forecast day', async () => {
    show(summary(12));
    expect(await screen.findByText('Due now: 12')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start review' }).getAttribute('href')).toBe(
      '/review/session',
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByLabelText(/: 6 due$/)).toBeTruthy();
  });

  it('offers no start when nothing is due', async () => {
    show(summary(0));
    expect(await screen.findByText('Nothing is due right now.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Start review' })).toBeNull();
  });

  it('says so when the summary cannot be loaded', async () => {
    show(new Error('down'));
    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
  });
});

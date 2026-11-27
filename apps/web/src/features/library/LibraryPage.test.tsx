import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ApiClient } from '@manabi/api-client';
import { learnerSettingsSchema } from '@manabi/core';
import type { CourseListEntry, User } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import '../../i18n';
import { ActivePluginContext, ActivePluginProvider } from '../../state/plugins';
import { ApiContext, SessionProvider } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import LibraryPage from './LibraryPage';

// FR-241: the Kanji area appears only when the active course's plugin has character study.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const user = {
  id: 1,
  role: 'learner',
  settings: learnerSettingsSchema.parse({ activeCourseId: 3 }),
} as User;

const course = (id: number, plugin: string) =>
  ({ id, plugin, enrolled: true, active: id === 3 }) as CourseListEntry;

function mount(courses: CourseListEntry[]) {
  const api = {
    GET: (url: string) => Promise.resolve(url === '/api/v1/me' ? user : { courses }),
  } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <SessionProvider>
        <ActivePluginProvider>
          <AppThemeProvider>
            <MemoryRouter>
              <LibraryPage />
            </MemoryRouter>
          </AppThemeProvider>
        </ActivePluginProvider>
      </SessionProvider>
    </ApiContext.Provider>,
  );
}

describe('LibraryPage', () => {
  it("shows the Kanji entry for the active course's Japanese plugin", async () => {
    mount([course(2, 'xx'), course(3, 'ja')]);
    await screen.findByRole('link', { name: /^Kanji/ });
    expect(screen.getByRole('link', { name: /^Kanji/ }).getAttribute('href')).toBe(
      '/library/kanji',
    );
    expect(screen.getByRole('link', { name: /^Grammar/ }).getAttribute('href')).toBe(
      '/library/grammar',
    );
  });

  it('hides the Kanji entry for a course with an unknown plugin', async () => {
    mount([course(3, 'xx')]);
    await screen.findByRole('heading', { name: 'Library' });
    await act(() => Promise.resolve());
    expect(screen.queryByRole('link', { name: /^Kanji/ })).toBeNull();
    screen.getByRole('link', { name: /^Grammar/ });
  });

  it('hides the Kanji entry when a stub plugin disables character study', () => {
    render(
      <ActivePluginContext.Provider
        value={{ ...japanese, features: { ...japanese.features, characterStudy: false } }}
      >
        <AppThemeProvider>
          <MemoryRouter>
            <LibraryPage />
          </MemoryRouter>
        </AppThemeProvider>
      </ActivePluginContext.Provider>,
    );
    screen.getByRole('heading', { name: 'Library' });
    expect(screen.queryByRole('link', { name: /^Kanji/ })).toBeNull();
    screen.getByRole('link', { name: /^Grammar/ });
  });
});

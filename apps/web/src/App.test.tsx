import type { ApiClient } from '@manabi/api-client';
import type { User } from '@manabi/core';
import type { Screen } from '@testing-library/react/pure';

// Records whether the admin chunk was loaded in the current test.
const mockAdminLoaded = jest.fn();
jest.mock('./features/admin/AdminPage', () => {
  mockAdminLoaded();
  return { __esModule: true, default: () => <h1>admin chunk</h1> };
});

let cleanup = () => {};
let screen: Screen;
beforeEach(() => {
  // Fresh modules per test, so App's lazy chunks start unloaded and tests do not depend on order.
  jest.resetModules();
  mockAdminLoaded.mockClear();
});
afterEach(() => cleanup());

async function renderApp(path: string, role: User['role'] | null, wide = false) {
  const rtl = await import('@testing-library/react/pure');
  const { MemoryRouter } = await import('react-router-dom');
  const { App } = await import('./App');
  const { ApiContext, SessionProvider } = await import('./state/session');
  const { AppThemeProvider } = await import('./theme');
  cleanup = rtl.cleanup;
  screen = rtl.screen;

  window.matchMedia = ((query: string) => ({
    matches: query === '(min-width: 768px)' && wide,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  const api = {
    GET: () => (role ? Promise.resolve({ role } as User) : Promise.reject(new Error('401'))),
  } as unknown as ApiClient;
  rtl.render(
    <ApiContext.Provider value={api}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <SessionProvider>
            <App />
          </SessionProvider>
        </MemoryRouter>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
}

describe('App shell', () => {
  it('shows a bottom tab bar below 768 px with five keyboard-reachable tabs (IF-01, IF-03)', async () => {
    await renderApp('/learn', 'learner');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(nav.getAttribute('data-layout')).toBe('tab-bar');
    expect(nav.previousElementSibling?.tagName).toBe('MAIN');
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((link) => link.textContent)).toEqual([
      'Learn',
      'Review',
      'Library',
      'Social',
      'Profile',
    ]);
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^\//);
      expect(link.tabIndex).toBe(0);
    }
  });

  it('shows a side rail at 768 px and above (IF-01)', async () => {
    await renderApp('/learn', 'learner', true);
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(nav.getAttribute('data-layout')).toBe('rail');
    expect(nav.nextElementSibling?.tagName).toBe('MAIN');
  });

  it('hides the admin entry from learners and never loads the admin chunk for them', async () => {
    await renderApp('/admin', 'learner');
    expect(await screen.findByRole('heading', { name: 'Learn' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(mockAdminLoaded).not.toHaveBeenCalled();
  });

  it('shows the admin entry and admin area to admins', async () => {
    await renderApp('/admin', 'admin');
    expect(await screen.findByRole('heading', { name: 'admin chunk' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Admin' })).toBeTruthy();
    expect(mockAdminLoaded).toHaveBeenCalled();
  });

  it('sends signed-out visitors to sign in', async () => {
    await renderApp('/learn', null);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

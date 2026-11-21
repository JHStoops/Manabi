import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiRequestError } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import type { User } from '@manabi/core';
import '../../i18n';
import { ApiContext, SessionProvider, useSession } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import AcceptInvitePage from './AcceptInvitePage';
import ChangePasswordPage from './ChangePasswordPage';
import SessionsList from './SessionsList';
import SignInPage from './SignInPage';
import SignOutButton from './SignOutButton';

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const learner = { id: 1, role: 'learner', mustChangePassword: false } as User;
const apiError = (
  status: number,
  code: ApiRequestError['code'],
  message = 'server says',
  details?: unknown,
) => new ApiRequestError(status, code, message, details);

/** `me` is the answer to GET /me (null = 401); `post` answers the POST under test. */
function renderAt(
  path: string,
  ui: React.ReactNode,
  {
    me = null,
    post = jest.fn(),
    get = jest.fn(),
    del = jest.fn(),
  }: {
    me?: User | null;
    post?: jest.Mock;
    get?: jest.Mock;
    del?: jest.Mock;
  } = {},
) {
  const api = {
    GET: (url: string) =>
      url === '/api/v1/me'
        ? me
          ? Promise.resolve(me)
          : Promise.reject(apiError(401, 'unauthenticated'))
        : get(url),
    POST: post,
    DELETE: del,
  } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <SessionProvider>
            <Routes>
              <Route path="/learn" element={<h1>Learn page</h1>} />
              <Route path="/sign-in" element={<h1>Signed out</h1>} />
              {/* Rendered as the element for every other path */}
              <Route path="*" element={ui} />
            </Routes>
          </SessionProvider>
        </MemoryRouter>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
  return api;
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('SignInPage', () => {
  const open = (post = jest.fn()) => {
    renderAt('/x', <SignInPage />, { post });
    return post;
  };

  it('asks for both fields before calling the API', async () => {
    const post = open();
    submit('Sign in');
    expect((await screen.findByRole('alert')).textContent).toMatch(/Enter your username or email/);
    expect(post).not.toHaveBeenCalled();
  });

  it('signs in and lands on the Learn tab', async () => {
    const post = open(jest.fn().mockResolvedValue({ user: learner }));
    await screen.findByLabelText('Username or email');
    type('Username or email', ' hana ');
    type('Password', 'secret');
    submit('Sign in');
    expect(await screen.findByRole('heading', { name: 'Learn page' })).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/api/v1/auth/login', {
      body: { identifier: 'hana', password: 'secret', clientKind: 'web' },
    });
  });

  it.each([
    [apiError(401, 'unauthenticated', 'x'), 'Wrong username or password.'],
    [
      apiError(401, 'unauthenticated', 'x', { reason: 'account_disabled' }),
      'This account is disabled. Ask an admin.',
    ],
    [apiError(429, 'rate_limited'), 'Too many attempts. Wait a few minutes and try again.'],
    [
      new TypeError('fetch failed'),
      'Cannot reach the server. Check your connection and try again.',
    ],
  ])('shows the catalog message for an API error', async (error, message) => {
    open(jest.fn().mockRejectedValue(error));
    await screen.findByLabelText('Username or email');
    type('Username or email', 'hana');
    type('Password', 'wrong');
    submit('Sign in');
    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });

  it('links to the password reset request page', async () => {
    open();
    const link = await screen.findByRole('link', { name: 'Forgot password?' });
    expect(link.getAttribute('href')).toBe('/forgot-password');
  });
});

describe('AcceptInvitePage', () => {
  const TOKEN = 'q7Xb3mZp0kLr8sTv2wYc5nHd9fGj4aEu6iOx1yRz0Bw';
  // The token comes from the route, so mount the page on its real path.
  const mount = (post: jest.Mock) => {
    const api = {
      GET: () => Promise.reject(apiError(401, 'unauthenticated')),
      POST: post,
    } as unknown as ApiClient;
    render(
      <ApiContext.Provider value={api}>
        <AppThemeProvider>
          <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
            <SessionProvider>
              <Routes>
                <Route path="/invite/:token" element={<AcceptInvitePage />} />
                <Route path="/learn" element={<h1>Learn page</h1>} />
              </Routes>
            </SessionProvider>
          </MemoryRouter>
        </AppThemeProvider>
      </ApiContext.Provider>,
    );
  };
  const fill = async (overrides: Record<string, string> = {}) => {
    await screen.findByLabelText('Username');
    const values = {
      Username: 'hana',
      'Display name': 'Hana',
      Password: 'a long passphrase',
      'Confirm password': 'a long passphrase',
      ...overrides,
    };
    for (const [label, value] of Object.entries(values)) type(label, value);
  };

  it.each([
    [{ Username: 'ha na' }, /Choose a username/],
    [{ 'Display name': ' ' }, /Enter a display name/],
    [{ Password: 'short', 'Confirm password': 'short' }, /at least 10 characters/],
    [{ 'Confirm password': 'different' }, /do not match/],
  ])('rejects invalid input %j without calling the API', async (overrides, message) => {
    const post = jest.fn();
    mount(post);
    await fill(overrides);
    submit('Create account');
    expect((await screen.findByRole('alert')).textContent).toMatch(message);
    expect(post).not.toHaveBeenCalled();
  });

  it('offers the four daily goals, defaulting to 20', async () => {
    mount(jest.fn());
    await screen.findByLabelText('Username');
    const goals = screen.getAllByRole('radio');
    expect(goals.map((g) => g.parentElement?.textContent)).toEqual([
      '10 XP',
      '20 XP',
      '30 XP',
      '50 XP',
    ]);
    expect((screen.getByLabelText('20 XP') as HTMLInputElement).checked).toBe(true);
  });

  it('creates the account with the chosen goal and lands on the Learn tab', async () => {
    const post = jest.fn().mockResolvedValue({ user: learner });
    mount(post);
    await fill();
    fireEvent.click(screen.getByLabelText('30 XP'));
    submit('Create account');
    expect(await screen.findByRole('heading', { name: 'Learn page' })).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/api/v1/auth/accept-invite', {
      body: expect.objectContaining({
        token: TOKEN,
        username: 'hana',
        displayName: 'Hana',
        password: 'a long passphrase',
        dailyGoal: 30,
        clientKind: 'web',
      }),
    });
  });

  it('explains an invalid invite link', async () => {
    mount(jest.fn().mockRejectedValue(apiError(404, 'not_found')));
    await fill();
    submit('Create account');
    expect((await screen.findByRole('alert')).textContent).toMatch(/invite link is not valid/);
  });

  it('shows a taken username from the server', async () => {
    mount(jest.fn().mockRejectedValue(apiError(409, 'conflict', 'That username is already taken')));
    await fill();
    submit('Create account');
    expect((await screen.findByRole('alert')).textContent).toBe('That username is already taken');
  });
});

describe('ChangePasswordPage', () => {
  const temp = { ...learner, mustChangePassword: true } as User;
  const open = (post = jest.fn()) => {
    renderAt('/x', <ChangePasswordPage />, { me: temp, post });
    return post;
  };
  const fill = async (overrides: Record<string, string> = {}) => {
    await screen.findByLabelText('Current password');
    const values = {
      'Current password': 'temporary-pass',
      'New password': 'a long passphrase',
      'Confirm password': 'a long passphrase',
      ...overrides,
    };
    for (const [label, value] of Object.entries(values)) type(label, value);
  };

  it.each([
    [{ 'Current password': '' }, /Enter your current password/],
    [{ 'New password': 'short', 'Confirm password': 'short' }, /at least 10 characters/],
    [{ 'Confirm password': 'different' }, /do not match/],
  ])('rejects invalid input %j', async (overrides, message) => {
    const post = open();
    await fill(overrides);
    submit('Change password');
    expect((await screen.findByRole('alert')).textContent).toMatch(message);
    expect(post).not.toHaveBeenCalled();
  });

  it('changes the password and continues to the Learn tab', async () => {
    const post = open(jest.fn().mockResolvedValue({ user: learner }));
    await fill();
    submit('Change password');
    expect(await screen.findByRole('heading', { name: 'Learn page' })).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/api/v1/auth/change-password', {
      body: { currentPassword: 'temporary-pass', newPassword: 'a long passphrase' },
    });
  });

  it('shows the server message when the current password is wrong', async () => {
    open(
      jest
        .fn()
        .mockRejectedValue(apiError(400, 'validation_failed', 'The current password is wrong')),
    );
    await fill();
    submit('Change password');
    expect((await screen.findByRole('alert')).textContent).toBe('The current password is wrong');
  });

  it('lets the user sign out instead', async () => {
    const post = jest.fn().mockResolvedValue(undefined);
    renderAt(
      '/x',
      <>
        <ChangePasswordPage />
        <SessionGate />
      </>,
      { me: temp, post },
    );
    submit('Sign out');
    expect(await screen.findByText('status: signedOut')).toBeTruthy();
    expect(post).toHaveBeenCalledWith('/api/v1/auth/logout', { body: {} });
  });
});

describe('SignOutButton', () => {
  it('shows an error when sign-out fails', async () => {
    renderAt('/x', <SignOutButton />, {
      me: learner,
      post: jest.fn().mockRejectedValue(apiError(503, 'service_unavailable')),
    });
    submit('Sign out');
    expect((await screen.findByRole('alert')).textContent).toMatch(/server is busy/);
  });
});

describe('SessionsList', () => {
  const sessions = [
    { id: 1, clientKind: 'web', lastSeenAt: '2026-01-02T03:04:05Z', current: true },
    { id: 2, clientKind: 'mobile', lastSeenAt: '2026-01-01T03:04:05Z', current: false },
  ];

  it('lists sessions and revokes another one, then reloads', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({ sessions })
      .mockResolvedValueOnce({ sessions: sessions.slice(0, 1) });
    const del = jest.fn().mockResolvedValue(undefined);
    renderAt('/x', <SessionsList />, { me: learner, get, del });
    expect(await screen.findByText(/Mobile app/)).toBeTruthy();
    expect(screen.getByText(/Web browser \(this device\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Sign out Mobile app/ }));
    await waitFor(() => expect(screen.queryByText(/Mobile app/)).toBeNull());
    expect(del).toHaveBeenCalledWith('/api/v1/me/sessions/{id}', {
      params: { path: { id: '2' } },
    });
  });

  it('signs the user out locally after revoking the current session', async () => {
    const get = jest.fn().mockResolvedValue({ sessions });
    renderAt(
      '/x',
      <>
        <SessionsList />
        <SessionGate />
      </>,
      { me: learner, get, del: jest.fn().mockResolvedValue(undefined) },
    );
    fireEvent.click(await screen.findByRole('button', { name: /^Sign out Web browser/ }));
    expect(await screen.findByText('status: signedOut')).toBeTruthy();
  });

  it('shows an error when revoking fails', async () => {
    const get = jest.fn().mockResolvedValue({ sessions });
    const del = jest.fn().mockRejectedValue(apiError(404, 'not_found'));
    renderAt('/x', <SessionsList />, { me: learner, get, del });
    fireEvent.click(await screen.findByRole('button', { name: /^Sign out Mobile app/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('That no longer exists.');
  });
});

function SessionGate() {
  const { status } = useSession();
  return <p>status: {status}</p>;
}

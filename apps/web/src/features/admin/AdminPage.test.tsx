import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiRequestError } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import type { AdminUser, ImportRun, Invite } from '@manabi/core';
import '../../i18n';
import { ApiContext, SessionProvider } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { ImportsPanel } from './ImportsPanel';
import { InvitesPanel } from './InvitesPanel';
import { UsersPanel } from './UsersPanel';

// Component tests for the admin console screens (#23): FR-002, FR-005, FR-200, FR-226, IF-10.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

const user = (over: Partial<AdminUser>): AdminUser => ({
  id: 1,
  username: 'boss',
  email: null,
  displayName: 'Boss',
  role: 'admin',
  mustChangePassword: false,
  timeZone: 'UTC',
  settings: {} as AdminUser['settings'],
  disabledAt: null,
  lastActiveDate: null,
  currentStreak: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

const boss = user({});
const hana = user({
  id: 2,
  username: 'hana',
  role: 'learner',
  lastActiveDate: '2026-11-20',
  currentStreak: 4,
});

function fakeApi(get: Record<string, unknown>) {
  const api = {
    GET: jest.fn((path: string) =>
      path === '/api/v1/me' ? Promise.resolve(boss) : Promise.resolve(get[path]),
    ),
    POST: jest.fn(),
    PATCH: jest.fn(),
    DELETE: jest.fn(() => Promise.resolve(undefined)),
  };
  return api;
}

function show(ui: JSX.Element, api: ReturnType<typeof fakeApi>) {
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>
        <MemoryRouter>
          <SessionProvider>{ui}</SessionProvider>
        </MemoryRouter>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
}

describe('UsersPanel', () => {
  it('lists users and changes role, disables and sets a temporary password', async () => {
    const api = fakeApi({ '/api/v1/admin/users': { users: [boss, hana] } });
    api.PATCH.mockResolvedValueOnce({ ...hana, role: 'admin' });
    api.PATCH.mockResolvedValueOnce({ ...hana, role: 'admin', disabledAt: '2026-11-21T00:00:00Z' });
    api.POST.mockResolvedValueOnce(undefined);
    show(<UsersPanel />, api);

    const row = (await screen.findByText('hana')).closest('tr')!;
    expect(within(row).getByText('2026-11-20')).toBeTruthy();
    expect(within(row).getByText('4')).toBeTruthy();
    // The admin's own row has no actions.
    const own = (await screen.findByText(/cannot change your own role/)).closest('tr')!;
    expect(within(own).queryByRole('button')).toBeNull();

    fireEvent.click(within(row).getByRole('button', { name: 'Make admin' }));
    await within(row).findByRole('button', { name: 'Make learner' });
    expect(api.PATCH).toHaveBeenLastCalledWith('/api/v1/admin/users/{id}', {
      params: { path: { id: '2' } },
      body: { role: 'admin' },
    });

    fireEvent.click(within(row).getByRole('button', { name: 'Disable' }));
    await within(row).findByText('Disabled');
    expect(api.PATCH).toHaveBeenLastCalledWith('/api/v1/admin/users/{id}', {
      params: { path: { id: '2' } },
      body: { disabled: true },
    });

    fireEvent.click(within(row).getByRole('button', { name: 'Temporary password' }));
    fireEvent.change(screen.getByLabelText('Temporary password for hana'), {
      target: { value: 'temporary pass 1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set temporary password' }));
    expect(await screen.findByText(/Temporary password set for hana/)).toBeTruthy();
    expect(api.POST).toHaveBeenCalledWith('/api/v1/admin/users/{id}/temporary-password', {
      params: { path: { id: '2' } },
      body: { password: 'temporary pass 1' },
    });
  });

  it('shows an API error', async () => {
    const api = fakeApi({ '/api/v1/admin/users': { users: [boss, hana] } });
    api.PATCH.mockRejectedValueOnce(
      new ApiRequestError(409, 'conflict', 'You cannot change your own role'),
    );
    show(<UsersPanel />, api);
    const row = (await screen.findByText('hana')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Disable' }));
    expect(await screen.findByText('You cannot change your own role')).toBeTruthy();
  });
});

describe('InvitesPanel', () => {
  const pending: Invite = {
    id: 5,
    email: 'kenji@example.com',
    role: 'learner',
    status: 'pending',
    createdAt: '2026-11-20T00:00:00.000Z',
    expiresAt: '2026-11-27T00:00:00.000Z',
  };

  it('creates an invite and shows its link to copy when it was not emailed', async () => {
    const api = fakeApi({ '/api/v1/admin/invites': { invites: [] } });
    api.POST.mockResolvedValueOnce({
      invite: pending,
      link: 'https://manabi.example.com/invite/abc',
      emailed: false,
    });
    show(<InvitesPanel />, api);
    expect(await screen.findByText('No invites yet.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Email (optional)'), {
      target: { value: 'kenji@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Account type'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Expires after (days)'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create invite' }));

    const link = (await screen.findByLabelText('Invite link')) as HTMLInputElement;
    expect(link.value).toBe('https://manabi.example.com/invite/abc');
    expect(screen.getByText(/not emailed/)).toBeTruthy();
    expect(api.POST).toHaveBeenCalledWith('/api/v1/admin/invites', {
      body: { role: 'admin', expiresInDays: 3, email: 'kenji@example.com' },
    });
  });

  it('lists invites and revokes a pending one', async () => {
    const api = fakeApi({ '/api/v1/admin/invites': { invites: [pending] } });
    show(<InvitesPanel />, api);
    const row = (await screen.findByText('kenji@example.com')).closest('tr')!;
    expect(within(row).getByText('Pending')).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Revoke' }));
    await waitFor(() =>
      expect(api.DELETE).toHaveBeenCalledWith('/api/v1/admin/invites/{id}', {
        params: { path: { id: '5' } },
      }),
    );
  });
});

describe('ImportsPanel', () => {
  const run: ImportRun = {
    id: 1,
    importer: 'jmdict',
    status: 'succeeded',
    startedAt: '2026-11-20T00:00:00.000Z',
    finishedAt: '2026-11-20T00:05:00.000Z',
    summary: { added: 10, updated: 2, skipped: 1 },
  };

  it('lists runs and starts an import', async () => {
    const api = fakeApi({ '/api/v1/admin/imports': { runs: [run] } });
    api.POST.mockResolvedValueOnce({ jobId: 'j1' });
    show(<ImportsPanel />, api);
    const row = (await screen.findByRole('cell', { name: 'jmdict' })).closest('tr')!;
    expect(within(row).getByText('Succeeded')).toBeTruthy();
    expect(within(row).getByText('+10 ~2 =1')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Dataset'), { target: { value: 'tatoeba' } });
    fireEvent.change(screen.getByLabelText('Course key'), { target: { value: 'ja-en' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run import' }));
    expect(await screen.findByText(/Import started/)).toBeTruthy();
    expect(api.POST).toHaveBeenCalledWith('/api/v1/admin/imports', {
      body: { importer: 'tatoeba', courseKey: 'ja-en' },
    });
  });

  it('says when the job queue is down', async () => {
    const api = fakeApi({ '/api/v1/admin/imports': { runs: [] } });
    api.POST.mockRejectedValueOnce(new ApiRequestError(503, 'service_unavailable', 'down'));
    show(<ImportsPanel />, api);
    fireEvent.change(await screen.findByLabelText('Course key'), { target: { value: 'ja-en' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run import' }));
    expect(await screen.findByText(/job queue is unavailable/)).toBeTruthy();
  });
});

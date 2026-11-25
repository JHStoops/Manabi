import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiRequestError } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import { learnerSettingsSchema } from '@manabi/core';
import type { User } from '@manabi/core';
import '../../i18n';
import { ApiContext, SessionProvider } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import ProfilePage from './ProfilePage';

// FR-007, Product Spec section 11: the settings form groups.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const user: User = {
  id: 1,
  username: 'hana',
  email: null,
  displayName: 'Hana',
  role: 'learner',
  mustChangePassword: false,
  timeZone: 'Asia/Tokyo',
  settings: learnerSettingsSchema.parse({ activeCourseId: 3 }),
  disabledAt: null,
};

function mount(patch: jest.Mock) {
  const api = {
    GET: (url: string) =>
      Promise.resolve(url === '/api/v1/me' ? user : { sessions: [], badges: [] }),
    PATCH: patch,
  } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <AppThemeProvider>
        <MemoryRouter>
          <SessionProvider>
            <ProfilePage />
          </SessionProvider>
        </MemoryRouter>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
}

const group = (name: string) => within(screen.getByRole('group', { name }));

describe('ProfilePage', () => {
  it('shows every setting in its group with the current values', async () => {
    mount(jest.fn());
    await screen.findByRole('group', { name: 'Profile' });
    expect(screen.getAllByRole('group').map((g) => g.querySelector('legend')?.textContent)).toEqual(
      ['Profile', 'Study', 'Display', 'Sound and motion', 'Social'],
    );
    const profile = group('Profile');
    expect((profile.getByLabelText('Display name') as HTMLInputElement).value).toBe('Hana');
    expect(profile.queryByLabelText('Time zone')).toBeNull();
    profile.getByLabelText('Avatar color');
    profile.getByLabelText(/Avatar initial/);
    expect(profile.getByRole('link', { name: 'Change password' }).getAttribute('href')).toBe(
      '/change-password',
    );
    const study = group('Study');
    expect((study.getByLabelText('Daily goal') as HTMLSelectElement).value).toBe('20');
    expect((study.getByLabelText('New items per day') as HTMLInputElement).value).toBe('20');
    expect((study.getByLabelText('Reviews per day') as HTMLInputElement).value).toBe('100');
    expect((study.getByLabelText('Drawing exercises') as HTMLInputElement).checked).toBe(true);
    expect((study.getByLabelText(/word bank/) as HTMLInputElement).checked).toBe(false);
    const display = group('Display');
    expect((display.getByLabelText('Theme') as HTMLSelectElement).value).toBe('sakura');
    expect((display.getByLabelText('Light or dark') as HTMLSelectElement).value).toBe('system');
    expect((display.getByLabelText('Furigana') as HTMLSelectElement).value).toBe('unlearned');
    expect((display.getByLabelText('Japanese text size') as HTMLSelectElement).value).toBe(
      'normal',
    );
    const sound = group('Sound and motion');
    for (const label of ['Sound effects', 'Play audio automatically']) {
      expect((sound.getByLabelText(label) as HTMLInputElement).checked).toBe(true);
    }
    expect((sound.getByLabelText('Reduce motion') as HTMLInputElement).checked).toBe(false);
    const social = group('Social');
    for (const label of ['Appear on the leaderboard', 'Allow nudges from friends']) {
      expect((social.getByLabelText(label) as HTMLInputElement).checked).toBe(true);
    }
  });

  it('sends only the changed fields through PATCH /me', async () => {
    const patch = jest.fn().mockImplementation((_url, { body }) =>
      Promise.resolve({
        ...user,
        displayName: body.displayName,
        settings: { ...user.settings, ...body.settings },
      }),
    );
    mount(patch);
    const display = await screen.findByLabelText('Display name');
    fireEvent.change(display, { target: { value: ' Hanako ' } });
    fireEvent.change(screen.getByLabelText('Daily goal'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Reviews per day'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'sumi' } });
    fireEvent.change(screen.getByLabelText(/Avatar initial/), { target: { value: 'は' } });
    fireEvent.click(screen.getByLabelText('Reduce motion'));
    fireEvent.click(screen.getByLabelText('Allow nudges from friends'));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect((await screen.findByRole('status')).textContent).toBe('Settings saved.');
    expect(patch).toHaveBeenCalledWith('/api/v1/me', {
      body: {
        displayName: 'Hanako',
        settings: {
          dailyGoal: 50,
          reviewCap: 250,
          theme: 'sumi',
          avatarInitial: 'は',
          reducedMotion: true,
          allowNudges: false,
        },
      },
    });
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('Hanako');

    // After saving, nothing is pending: the next save sends an empty patch.
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(patch).toHaveBeenLastCalledWith('/api/v1/me', { body: { settings: {} } }),
    );
  });

  it('marks invalid fields and does not send them', async () => {
    const patch = jest.fn();
    mount(patch);
    const display = await screen.findByLabelText('Display name');
    fireEvent.change(display, { target: { value: ' ' } });
    const cap = screen.getByLabelText('New items per day');
    fireEvent.change(cap, { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/Avatar initial/), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    for (const [field, message] of [
      [display, 'Enter a display name.'],
      [cap, 'Enter a whole number from 0 to 200.'],
      [screen.getByLabelText(/Avatar initial/), 'Use one character, or leave this empty.'],
    ] as const) {
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(document.getElementById(field.getAttribute('aria-describedby')!)?.textContent).toBe(
        message,
      );
    }
    expect(
      (screen.getByLabelText('Reviews per day') as HTMLElement).getAttribute('aria-invalid'),
    ).toBe('false');
    expect(patch).not.toHaveBeenCalled();
  });

  it('shows server rejections', async () => {
    const patch = jest
      .fn()
      .mockRejectedValue(new ApiRequestError(400, 'validation_failed', 'Something is off'));
    mount(patch);
    fireEvent.click(await screen.findByLabelText('Reduce motion'));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Something is off');
    expect(screen.getByRole('status').textContent).toBe('');
  });
});

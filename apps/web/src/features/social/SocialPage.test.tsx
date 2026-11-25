import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiRequestError } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import type { FriendList, NudgeList } from '@manabi/core';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import SocialPage from './SocialPage';

// FR-182, FR-183: the friends list and the nudge notification list.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const friends: FriendList = {
  friends: [
    {
      id: 2,
      displayName: 'Ken',
      currentStreak: 12,
      level: 4,
      weeklyXp: 250,
      section: 'Greetings',
      following: true,
    },
  ],
};
const nudges: NudgeList = {
  nudges: [
    {
      id: 1,
      fromUserId: 2,
      fromDisplayName: 'Ken',
      kind: 'keep_going',
      sentAt: '2026-11-25T01:00:00.000Z',
      seen: false,
    },
    {
      id: 2,
      fromUserId: 3,
      fromDisplayName: 'Mei',
      kind: 'nice_work',
      sentAt: '2026-11-24T01:00:00.000Z',
      seen: true,
    },
  ],
};

function mount(post = jest.fn().mockResolvedValue(null), del = jest.fn().mockResolvedValue(null)) {
  const api = {
    GET: (url: string) => Promise.resolve(url === '/api/v1/friends' ? friends : nudges),
    POST: post,
    DELETE: del,
  } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <AppThemeProvider>
        <SocialPage />
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
  return { post, del };
}

describe('SocialPage', () => {
  it('lists friends with streak, level, weekly XP and section', async () => {
    mount();
    const row = (await screen.findByText('Ken', { selector: 'td' })).closest('tr')!;
    expect(row.textContent).toContain('12');
    expect(row.textContent).toContain('4');
    expect(row.textContent).toContain('250');
    expect(row.textContent).toContain('Greetings');
  });

  it('sends a nudge and then shows it as sent', async () => {
    const { post } = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Nice work: Ken' }));
    await screen.findByText('Nudge sent');
    expect(post).toHaveBeenCalledWith('/api/v1/nudges', {
      body: { toUserId: 2, kind: 'nice_work' },
    });
  });

  it('shows why a nudge was refused', async () => {
    const post = jest
      .fn()
      .mockRejectedValue(
        new ApiRequestError(409, 'conflict', 'You already nudged this friend today'),
      );
    mount(post);
    fireEvent.click(await screen.findByRole('button', { name: 'Keep going: Ken' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'You already nudged this friend today',
    );
  });

  it('unfollows a friend', async () => {
    const { del } = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Unfollow: Ken' }));
    await waitFor(() => expect(screen.queryByText('Ken', { selector: 'td' })).toBeNull());
    expect(del).toHaveBeenCalledWith('/api/v1/follows/{userId}', {
      params: { path: { userId: '2' } },
    });
  });

  it('lists nudges, marks the unseen ones new and marks them seen', async () => {
    const { post } = mount();
    expect(await screen.findByText(/Ken says keep going!/)).toHaveProperty(
      'textContent',
      'Ken says keep going! (new)',
    );
    expect(screen.getByText('Mei says nice work!').textContent).not.toContain('(new)');
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/nudges/seen', { body: {} }));
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import type { ApiClient } from '@manabi/api-client';
import { learnerSettingsSchema } from '@manabi/core';
import type { User } from '@manabi/core';
import '../../i18n';
import { ApiContext, SessionProvider } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import Badges from './Badges';
import Leaderboard from './Leaderboard';

// FR-180, FR-181, FR-184: the weekly board and the top-three badges.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const me = (settings: object): User => ({
  id: 2,
  username: 'ken',
  email: null,
  displayName: 'Ken',
  role: 'learner',
  mustChangePassword: false,
  timeZone: 'Asia/Tokyo',
  settings: learnerSettingsSchema.parse(settings),
  disabledAt: null,
});

function mount(user: User, responses: Record<string, unknown>, ui: JSX.Element) {
  const api = {
    GET: (url: string) => Promise.resolve(url === '/api/v1/me' ? user : responses[url]),
  } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <AppThemeProvider>
        <SessionProvider>{ui}</SessionProvider>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
}

describe('Leaderboard', () => {
  const board = {
    weekStart: '2026-11-23',
    entries: [
      { rank: 1, userId: 1, displayName: 'Hana', xp: 120 },
      { rank: 2, userId: 2, displayName: 'Ken', xp: 80 },
      { rank: 2, userId: 3, displayName: 'Rei', xp: 80 },
    ],
  };

  it('lists learners by rank, marking the caller', async () => {
    mount(me({}), { '/api/v1/leaderboard': board }, <Leaderboard />);
    const items = await screen.findAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      '1. Hana: 120 XP',
      '2. Ken: 80 XP (you)',
      '2. Rei: 80 XP',
    ]);
    expect(screen.queryByText(/not on the board/)).toBeNull();
  });

  it('tells an opted-out learner they are not listed', async () => {
    mount(
      me({ appearOnLeaderboard: false }),
      { '/api/v1/leaderboard': { ...board, entries: [] } },
      <Leaderboard />,
    );
    await screen.findByText(/not on the board/);
    await screen.findByText('Nobody has earned XP this week yet.');
  });
});

describe('Badges', () => {
  it('shows each top-three finish, or says there are none', async () => {
    mount(
      me({}),
      { '/api/v1/me/badges': { badges: [{ weekStart: '2026-11-16', rank: 1, xp: 300 }] } },
      <Badges />,
    );
    await screen.findByText('Week of 2026-11-16: place 1 (300 XP)');
    cleanup();
    mount(me({}), { '/api/v1/me/badges': { badges: [] } }, <Badges />);
    await screen.findByText(/No badges yet/);
  });
});

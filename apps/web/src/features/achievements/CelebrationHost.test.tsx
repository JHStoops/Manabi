import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { learnerSettingsSchema } from '@manabi/core';
import type { Achievement, UnlockedAchievement, User } from '@manabi/core';
import type { ApiClient } from '@manabi/api-client';
import '../../i18n';
import { CelebrationProvider, celebrationReducer, useCelebrate } from '../../state/celebrations';
import { ApiContext, SessionProvider, useSession } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { CelebrationHost } from './CelebrationHost';

// FR-165, FR-167: a celebration appears once, not again on reload, and follows the motion and
// sound settings.

const streak7: UnlockedAchievement = {
  key: 'streak_7',
  group: 'streak',
  title: '7-day streak',
  threshold: 7,
};
const kanji10: UnlockedAchievement = {
  key: 'kanji_10',
  group: 'kanji',
  title: '10 kanji at Familiar',
  threshold: 10,
};

let reduceDevice = false;
const audioContext = jest.fn(() => ({
  currentTime: 0,
  destination: {},
  createOscillator: () => ({ frequency: {}, connect() {}, start() {}, stop() {} }),
  close: () => Promise.resolve(),
}));

beforeEach(() => {
  reduceDevice = false;
  audioContext.mockClear();
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = audioContext;
  window.matchMedia = ((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' && reduceDevice,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

/** A fake server holding the learner's unlocks; POST /me/achievements/seen records seenAt. */
function fakeServer(earned: UnlockedAchievement[], settings: object = {}) {
  const rows: Achievement[] = earned.map((a) => ({
    ...a,
    earnedAt: '2026-11-28T00:00:00.000Z',
    seenAt: null,
  }));
  const user = { id: 1, role: 'learner', settings: learnerSettingsSchema.parse(settings) } as User;
  const post = jest.fn((_url: string, { body }: { body: { keys: string[] } }) => {
    for (const row of rows)
      if (body.keys.includes(row.key)) row.seenAt ??= new Date().toISOString();
    return Promise.resolve({ achievements: rows });
  });
  const api = {
    GET: (url: string) =>
      Promise.resolve(url === '/api/v1/me/achievements' ? { achievements: rows } : user),
    POST: post,
  } as unknown as ApiClient;
  return { api, post, rows };
}

let celebrate: (a: readonly UnlockedAchievement[]) => void = () => undefined;
function Unlocker() {
  celebrate = useCelebrate();
  return <span data-testid="ready" />;
}

// As in the app, celebrations mount once the learner (and their settings) has loaded.
function SignedIn({ children }: { children: ReactNode }) {
  return useSession().status === 'signedIn' ? children : null;
}

async function mount(api: ApiClient) {
  render(
    <ApiContext.Provider value={api}>
      <SessionProvider>
        <AppThemeProvider>
          <SignedIn>
            <CelebrationProvider>
              <Unlocker />
              <CelebrationHost />
            </CelebrationProvider>
          </SignedIn>
        </AppThemeProvider>
      </SessionProvider>
    </ApiContext.Provider>,
  );
  await screen.findByTestId('ready');
}

describe('achievement celebrations', () => {
  it('shows an unseen unlock once on load, full screen for a streak, and not on reload', async () => {
    const server = fakeServer([streak7]);
    await mount(server.api);
    const dialog = await screen.findByRole('dialog', { name: '7-day streak' });
    expect(screen.getByTestId('celebration').getAttribute('data-layout')).toBe('full-screen');
    expect(dialog.textContent).toContain('Streak milestone');
    await waitFor(() =>
      expect(server.post).toHaveBeenCalledWith('/api/v1/me/achievements/seen', {
        body: { keys: ['streak_7'] },
      }),
    );
    // The dismiss button has focus, so Enter or Space dismisses it from the keyboard.
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();

    // A reload: the server now has it as seen, so nothing is shown.
    cleanup();
    await mount(server.api);
    await act(() => Promise.resolve());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('celebrates unlocks from a progress response in turn, each once', async () => {
    const server = fakeServer([]);
    await mount(server.api);
    act(() => celebrate([kanji10, streak7]));
    expect(await screen.findByRole('dialog', { name: '10 kanji at Familiar' })).not.toBeNull();
    expect(screen.getByTestId('celebration').getAttribute('data-layout')).toBe('card');
    // A replayed response does not queue them again.
    act(() => celebrate([kanji10]));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(await screen.findByRole('dialog', { name: '7-day streak' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(server.post).toHaveBeenCalledWith('/api/v1/me/achievements/seen', {
      body: { keys: ['kanji_10'] },
    });
  });

  it('plays confetti and a fanfare only when motion and sound are on (FR-167)', async () => {
    const on = fakeServer([kanji10]);
    await mount(on.api);
    await screen.findByRole('dialog');
    await waitFor(() => expect(screen.queryByTestId('confetti')).not.toBeNull());
    expect(audioContext).toHaveBeenCalled();

    cleanup();
    audioContext.mockClear();
    const off = fakeServer([kanji10], { reducedMotion: true, soundEffects: false });
    await mount(off.api);
    await screen.findByRole('dialog');
    await waitFor(() => expect(off.post).toHaveBeenCalled());
    expect(screen.queryByTestId('confetti')).toBeNull();
    expect(audioContext).not.toHaveBeenCalled();

    cleanup();
    reduceDevice = true;
    await mount(fakeServer([kanji10]).api);
    await screen.findByRole('dialog');
    expect(screen.queryByTestId('confetti')).toBeNull();
  });
});

describe('celebrationReducer', () => {
  it('queues each key once per page load and dismisses the head', () => {
    let state = celebrationReducer(
      { queue: [], handled: [] },
      { type: 'unlocked', achievements: [streak7, streak7, kanji10] },
    );
    expect(state.queue.map((a) => a.key)).toEqual(['streak_7', 'kanji_10']);
    state = celebrationReducer(state, { type: 'dismissed' });
    state = celebrationReducer(state, { type: 'unlocked', achievements: [streak7] });
    expect(state.queue.map((a) => a.key)).toEqual(['kanji_10']);
  });
});

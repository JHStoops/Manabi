import { cleanup, render, screen } from '@testing-library/react';
import { useTheme } from '@emotion/react';
import { learnerSettingsSchema } from '@manabi/core';
import type { User } from '@manabi/core';
import { ApiContext, SessionProvider } from '../state/session';
import type { ApiClient } from '@manabi/api-client';
import { AppThemeProvider } from './AppThemeProvider';
import { Confetti, useSound } from './effects';

// FR-166, FR-167: settings take effect.
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

function Sound() {
  const play = useSound();
  return <button onClick={() => play('correct')}>ding</button>;
}
function ThemeName() {
  const { name, mode } = useTheme();
  return <span data-testid="theme">{`${name} ${mode}`}</span>;
}

async function mount(settings: object, child: React.ReactNode) {
  const user = {
    id: 1,
    role: 'learner',
    settings: learnerSettingsSchema.parse(settings),
  } as User;
  const api = { GET: () => Promise.resolve(user) } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <SessionProvider>
        <AppThemeProvider>{child}</AppThemeProvider>
      </SessionProvider>
    </ApiContext.Provider>,
  );
  await screen.findByTestId('ready');
}
const ready = <span data-testid="ready" />;

describe('settings take effect', () => {
  it('switches the theme with the setting', async () => {
    await mount(
      { theme: 'umi', colorMode: 'dark' },
      <>
        <ThemeName />
        {ready}
      </>,
    );
    expect(screen.getByTestId('theme').textContent).toBe('umi dark');
  });

  it('shows confetti unless the learner or the device reduces motion', async () => {
    await mount(
      {},
      <>
        <Confetti />
        {ready}
      </>,
    );
    expect(screen.queryByTestId('confetti')).not.toBeNull();
    cleanup();
    await mount(
      { reducedMotion: true },
      <>
        <Confetti />
        {ready}
      </>,
    );
    expect(screen.queryByTestId('confetti')).toBeNull();
    cleanup();
    reduceDevice = true;
    await mount(
      {},
      <>
        <Confetti />
        {ready}
      </>,
    );
    expect(screen.queryByTestId('confetti')).toBeNull();
  });

  it('mutes sound effects when turned off', async () => {
    await mount(
      { soundEffects: false },
      <>
        <Sound />
        {ready}
      </>,
    );
    screen.getByText('ding').click();
    expect(audioContext).not.toHaveBeenCalled();
    cleanup();
    await mount(
      {},
      <>
        <Sound />
        {ready}
      </>,
    );
    screen.getByText('ding').click();
    expect(audioContext).toHaveBeenCalledTimes(1);
  });
});

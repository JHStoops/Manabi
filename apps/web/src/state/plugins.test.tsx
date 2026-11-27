import { render, screen, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import type { ApiClient } from '@manabi/api-client';
import { ApiContext } from './session';
import { ActivePluginProvider, ActivePluginStatusContext } from './plugins';

// FR-241, #260: the provider tells a plugin that is still loading apart from one known to be absent.

let activeCourseId: number | null = 1;
jest.mock('./session', () => ({
  ...jest.requireActual('./session'),
  useSettings: () => ({ activeCourseId }),
}));

function Probe() {
  return <p>{`status:${useContext(ActivePluginStatusContext)}`}</p>;
}

function mount(get: () => Promise<unknown>) {
  const api = { GET: get } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <ActivePluginProvider>
        <Probe />
      </ActivePluginProvider>
    </ApiContext.Provider>,
  );
}

describe('ActivePluginProvider status', () => {
  it('is none with no active course', async () => {
    activeCourseId = null;
    mount(() => Promise.reject(new Error('never asked')));
    await screen.findByText('status:none');
  });

  it('is loading until the courses arrive, then ready for a known plugin', async () => {
    activeCourseId = 1;
    mount(() => Promise.resolve({ courses: [{ id: 1, plugin: 'ja' }] }));
    screen.getByText('status:loading');
    await screen.findByText('status:ready');
  });

  it('is none for an unknown plugin', async () => {
    activeCourseId = 1;
    mount(() => Promise.resolve({ courses: [{ id: 1, plugin: 'xx' }] }));
    await waitFor(() => screen.getByText('status:none'));
  });

  it('is none when the courses fail to load', async () => {
    activeCourseId = 1;
    mount(() => Promise.reject(new Error('offline')));
    await screen.findByText('status:none');
  });
});

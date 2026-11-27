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

  it('is error when the courses fail to load (#263)', async () => {
    activeCourseId = 1;
    mount(() => Promise.reject(new Error('offline')));
    await screen.findByText('status:error');
  });

  it('never shows the last course as ready, or none, for a course that is not looked up yet', async () => {
    activeCourseId = 1;
    const api = {
      GET: () =>
        Promise.resolve({
          courses: [
            { id: 1, plugin: 'ja' },
            { id: 2, plugin: 'xx' },
          ],
        }),
    } as unknown as ApiClient;
    // A new element each time: re-rendering the same element would bail out.
    const tree = () => (
      <ApiContext.Provider value={api}>
        <ActivePluginProvider>
          <Probe />
        </ActivePluginProvider>
      </ApiContext.Provider>
    );
    const { rerender } = render(tree());
    await screen.findByText('status:ready');
    activeCourseId = 2;
    rerender(tree());
    // The very first render for course 2 is loading, not course 1's ready.
    screen.getByText('status:loading');
    await screen.findByText('status:none');
    activeCourseId = null;
    rerender(tree());
    screen.getByText('status:none');
    activeCourseId = 1;
    rerender(tree());
    screen.getByText('status:loading');
    await screen.findByText('status:ready');
  });
});

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import type { LibraryItem, LibraryItemDetail } from '@manabi/core';
import type { LanguagePlugin } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import '../../i18n';
import type { ActivePluginStatus } from '../../state/plugins';
import { ActivePluginContext, ActivePluginStatusContext } from '../../state/plugins';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import KanaDetailPage from './KanaDetailPage';

// FR-070, FR-071, FR-241: the kana detail page, from fixture data.

jest.mock('../strokes/StrokeCanvas', () => ({
  StrokeCanvas: ({ mode }: { mode: string }) => <div data-testid="canvas">{mode}</div>,
}));

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const kana = (character: string, romaji: string): LibraryItemDetail =>
  ({
    id: 1,
    key: `ja:kana:${character}`,
    type: 'kana',
    levelCode: 'kana',
    stage: 3,
    data: { character, script: 'hiragana', romaji },
    facets: [],
    links: [
      {
        kind: 'contains',
        direction: 'incoming',
        item: {
          id: 2,
          key: 'ja:word:a',
          type: 'word',
          levelCode: 'N5',
          stage: null,
          data: { written: 'あめ', reading: 'あめ', senses: [{ meanings: ['rain'] }] },
        } as LibraryItem,
      },
    ],
    sentences: [],
  }) as LibraryItemDetail;

const requested: unknown[] = [];
function mount(
  found: LibraryItemDetail | Error,
  plugin: LanguagePlugin | null = japanese,
  status: ActivePluginStatus = 'ready',
) {
  const api = {
    GET: (_url: string, init: unknown) => (
      requested.push(init),
      found instanceof Error ? Promise.reject(found) : Promise.resolve(found)
    ),
  } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <AppThemeProvider>
        <ActivePluginStatusContext.Provider value={status}>
          <ActivePluginContext.Provider value={plugin}>
            <MemoryRouter initialEntries={['/library/kana/ja%3Akana%3A%E3%81%82']}>
              <Routes>
                <Route path="/library/kana/:key" element={<KanaDetailPage />} />
              </Routes>
            </MemoryRouter>
          </ActivePluginContext.Provider>
        </ActivePluginStatusContext.Provider>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
}

describe('KanaDetailPage', () => {
  it('says there is no character study once the plugin is known to be absent, not Loading (#260, FR-241)', async () => {
    mount(kana('あ', 'a'), null, 'none');
    await screen.findByText("This course's language has no character study.");
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('says the course could not be loaded when the courses failed (#263)', async () => {
    mount(kana('あ', 'a'), null, 'error');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Your course could not be loaded. Check your connection and reload the page.',
    );
  });

  it('keeps showing Loading while the plugin is still being looked up (#260)', async () => {
    mount(kana('あ', 'a'), null, 'loading');
    await act(() => Promise.resolve());
    screen.getByText('Loading…');
  });

  it('gives the Library back link a 44 px tap target (#260, IF-03)', async () => {
    mount(kana('あ', 'a'));
    const style = getComputedStyle(await screen.findByRole('link', { name: 'Library' }));
    expect(style.minHeight).toBe('44px');
    expect(style.minWidth).toBe('44px');
  });

  it('shows the character, romaji, script, stage and the words that use it', async () => {
    mount(kana('あ', 'a'));
    await screen.findByRole('heading', { name: 'a', level: 1 });
    screen.getByText('Hiragana · Stage 3');
    expect(requested[0]).toEqual({ params: { path: { key: 'ja:kana:あ' } } });
    expect(screen.getByRole('link', { name: 'あめ' }).getAttribute('href')).toBe(
      '/library/words/ja%3Aword%3Aa',
    );
  });

  it('shows a katakana kana that is not started', async () => {
    const item = kana('ア', 'a');
    mount({ ...item, stage: null, data: { ...item.data, script: 'katakana' } });
    await screen.findByText('Katakana · Not started');
  });

  it('switches the stroke canvas between animation and trace', async () => {
    mount(kana('あ', 'a'));
    expect((await screen.findByTestId('canvas')).textContent).toBe('animate');
    fireEvent.click(screen.getByRole('button', { name: 'Practice drawing' }));
    expect(screen.getByTestId('canvas').textContent).toBe('trace');
  });

  it('has no canvas for a digraph', async () => {
    mount(kana('きゃ', 'kya'));
    await screen.findByRole('heading', { name: 'kya', level: 1 });
    expect(screen.queryByTestId('canvas')).toBeNull();
  });

  it('says so for a non-kana item, a failed load and a plugin without character study', async () => {
    mount({ ...kana('あ', 'a'), type: 'word' });
    await screen.findByText('This item is not a kana.');
    cleanup();
    mount(new Error('x'));
    await screen.findByRole('alert');
    cleanup();
    mount(kana('あ', 'a'), {
      ...japanese,
      features: { ...japanese.features, characterStudy: false },
    });
    await screen.findByText("This course's language has no character study.");
  });
});

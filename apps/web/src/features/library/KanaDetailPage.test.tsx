import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import type { LibraryItem, LibraryItemDetail } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import '../../i18n';
import { ActivePluginContext } from '../../state/plugins';
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

function mount(found: LibraryItemDetail | Error, plugin = japanese) {
  const api = {
    GET: () => (found instanceof Error ? Promise.reject(found) : Promise.resolve(found)),
  } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <AppThemeProvider>
        <ActivePluginContext.Provider value={plugin}>
          <MemoryRouter initialEntries={['/library/kana/x']}>
            <Routes>
              <Route path="/library/kana/:key" element={<KanaDetailPage />} />
            </Routes>
          </MemoryRouter>
        </ActivePluginContext.Provider>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
}

describe('KanaDetailPage', () => {
  it('shows the character, romaji, script, stage and the words that use it', async () => {
    mount(kana('あ', 'a'));
    await screen.findByRole('heading', { name: 'a', level: 1 });
    screen.getByText('Hiragana · Stage 3');
    expect(screen.getByRole('link', { name: 'あめ' }).getAttribute('href')).toBe(
      '/library/words/ja%3Aword%3Aa',
    );
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

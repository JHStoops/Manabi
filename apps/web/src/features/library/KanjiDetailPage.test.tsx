import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import type { LanguagePlugin, LibraryItem, LibraryItemDetail } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import '../../i18n';
import type { ActivePluginStatus } from '../../state/plugins';
import { ActivePluginContext, ActivePluginStatusContext } from '../../state/plugins';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import KanjiDetailPage from './KanjiDetailPage';

// FR-070, FR-071, FR-241, IF-03: each block of the kanji detail page, from fixture data.

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

const base = { id: 1, levelCode: 'N5' as const, stage: 5 as number | null };
const kanji = (key: string, character: string, data: object = {}): LibraryItem =>
  ({
    ...base,
    key,
    type: 'kanji',
    data: {
      character,
      meanings: ['eat'],
      onReadings: ['ショク'],
      kunReadings: ['た.べる', 'く.う'],
      strokeCount: 9,
      components: ['人', '良'],
      ...data,
    },
  }) as LibraryItem;
const word = (key: string, written: string, stage: number | null): LibraryItem =>
  ({
    ...base,
    key,
    type: 'word',
    stage,
    data: { written, reading: 'たべる', senses: [{ meanings: ['to eat'] }] },
  }) as LibraryItem;

const detail: LibraryItemDetail = {
  ...kanji('ja:kanji:食', '食'),
  facets: [],
  links: [
    { kind: 'component', direction: 'outgoing', item: kanji('ja:kanji:良', '良') },
    { kind: 'contains', direction: 'incoming', item: word('ja:word:a', '食べない', null) },
    { kind: 'contains', direction: 'incoming', item: word('ja:word:b', '食べる', 4) },
  ],
  sentences: [
    {
      id: 1,
      text: '食べる',
      translation: 'I eat.',
      tokens: [{ surface: '食べる', base: '食べる', reading: 'たべる' }],
      attribution: null,
    },
  ],
};

function mount(
  found: LibraryItemDetail | Error,
  plugin: LanguagePlugin | null = japanese,
  status: ActivePluginStatus = 'ready',
) {
  const api = {
    GET: () => (found instanceof Error ? Promise.reject(found) : Promise.resolve(found)),
  } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <AppThemeProvider>
        <ActivePluginStatusContext.Provider value={status}>
          <ActivePluginContext.Provider value={plugin}>
            <MemoryRouter initialEntries={['/library/kanji/ja:kanji:食']}>
              <Routes>
                <Route path="/library/kanji/:key" element={<KanjiDetailPage />} />
              </Routes>
            </MemoryRouter>
          </ActivePluginContext.Provider>
        </ActivePluginStatusContext.Provider>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
}

describe('KanjiDetailPage', () => {
  it('says the course could not be loaded when the courses failed (#263)', async () => {
    mount(detail, null, 'error');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Your course could not be loaded. Check your connection and reload the page.',
    );
  });

  it('says there is no character study once the plugin is known to be absent, not Loading (#260, FR-241)', async () => {
    mount(detail, null, 'none');
    await screen.findByText("This course's language has no character study.");
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('keeps showing Loading while the plugin is still being looked up (#260)', async () => {
    mount(detail, null, 'loading');
    await act(() => Promise.resolve());
    screen.getByText('Loading…');
  });

  it('gives the Library back link a 44 px tap target (#260, IF-03)', async () => {
    mount(detail);
    const style = getComputedStyle(await screen.findByRole('link', { name: 'Library' }));
    expect(style.minHeight).toBe('44px');
    expect(style.minWidth).toBe('44px');
  });

  it('shows the header, meanings and readings with okurigana and the first-taught one marked', async () => {
    mount(detail);
    await screen.findByRole('heading', { name: 'eat', level: 1 });
    screen.getByText('N5 · 9 strokes · Stage 5');
    const on = screen.getByText('ショク', { exact: false });
    expect(on.textContent).toContain('(taught first)');
    // た.べる: the okurigana べる is its own element, without the dot.
    expect(screen.getAllByText('べる')[0]!.tagName).toBe('SPAN');
    expect(screen.queryByText(/た\.べ/)).toBeNull();
  });

  it('links components to their kanji pages and shows unlinked parts as text', async () => {
    mount(detail);
    expect((await screen.findByRole('link', { name: '良' })).getAttribute('href')).toBe(
      '/library/kanji/ja:kanji:良',
    );
    // The imported radical comes first and is labelled; a part without a course item is plain text.
    expect(screen.getByText('(radical)', { exact: false }).closest('li')!.textContent).toBe(
      '人 (radical)',
    );
  });

  it('lists words with their stage, started ones first', async () => {
    mount(detail);
    const items = await screen.findAllByText(/to eat/);
    expect(items[0]!.textContent).toContain('Stage 4');
    expect(items[1]!.textContent).toContain('Not started');
    expect(screen.getByRole('link', { name: '食べる' }).getAttribute('href')).toBe(
      '/library/words/ja%3Aword%3Ab',
    );
  });

  it('gives component and word links a 44 px tap target', async () => {
    mount(detail);
    for (const name of ['良', '食べる', '食べない']) {
      const style = getComputedStyle(await screen.findByRole('link', { name }));
      expect(style.minHeight).toBe('44px');
      expect(style.minWidth).toBe('44px');
    }
  });

  it('shows no kanji study for a plugin without character study, and waits for the plugin', async () => {
    mount(detail, { ...japanese, features: { ...japanese.features, characterStudy: false } });
    await screen.findByText("This course's language has no character study.");
    expect(screen.queryByTestId('canvas')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'eat' })).toBeNull();
    cleanup();
    mount(detail, null);
    await act(() => Promise.resolve());
    screen.getByText('Loading…');
  });

  it('shows the example sentences', async () => {
    mount(detail);
    await screen.findByText('I eat.');
  });

  it('switches the stroke canvas between animation and trace mode', async () => {
    mount(detail);
    expect((await screen.findByTestId('canvas')).textContent).toBe('animate');
    fireEvent.click(screen.getByRole('button', { name: 'Practice drawing' }));
    expect(screen.getByTestId('canvas').textContent).toBe('trace');
    fireEvent.click(screen.getByRole('button', { name: 'Watch stroke order' }));
    expect(screen.getByTestId('canvas').textContent).toBe('animate');
  });

  it('says so for an item that is not a kanji, and for a failed load', async () => {
    mount({ ...detail, type: 'word' });
    await screen.findByText('This item is not a kanji.');
    cleanup();
    mount(new Error('x'));
    await screen.findByRole('alert');
  });
});

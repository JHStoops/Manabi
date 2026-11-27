import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import { learnerSettingsSchema } from '@manabi/core';
import type { User } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import '../../i18n';
import { AppThemeProvider } from '../../theme';
import { ActivePluginContext } from '../../state/plugins';
import { ApiContext, SessionProvider } from '../../state/session';
import WordPage from './WordPage';

// FR-100: reading, meanings, part of speech, example sentence and kanji links; FR-102: stage.

beforeAll(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const user = { id: 1, role: 'learner', settings: learnerSettingsSchema.parse({}) } as User;
const kanjiLink = (character: string) => ({
  kind: 'contains',
  direction: 'outgoing',
  item: { id: 9, key: `ja:kanji:${character}`, type: 'kanji', data: { character }, stage: null },
});
const detail = (links: unknown[], stage: number | null = 3) => ({
  id: 1,
  key: 'ja:word:日本:にほん',
  type: 'word',
  data: {
    written: '日本',
    reading: 'にほん',
    senses: [{ partsOfSpeech: ['n'], meanings: ['Japan'] }],
  },
  stage,
  facets: [],
  links,
  sentences: [
    {
      id: 1,
      text: '日本へ行く',
      translation: 'I go to Japan.',
      tokens: [{ surface: '日本', base: '日本', reading: 'にほん' }],
      attribution: null,
    },
  ],
});

function mount(body: unknown) {
  const GET = jest.fn((url: string) =>
    url === '/api/v1/me' ? Promise.resolve(user) : Promise.resolve(body),
  );
  render(
    <ApiContext.Provider value={{ GET } as unknown as ApiClient}>
      <SessionProvider>
        <ActivePluginContext.Provider value={japanese}>
          <AppThemeProvider>
            <MemoryRouter initialEntries={['/library/words/ja:word:日本:にほん']}>
              <Routes>
                <Route path="/library/words/:key" element={<WordPage />} />
              </Routes>
            </MemoryRouter>
          </AppThemeProvider>
        </ActivePluginContext.Provider>
      </SessionProvider>
    </ApiContext.Provider>,
  );
  return GET;
}

function expectTapTarget(link: HTMLElement) {
  const style = getComputedStyle(link);
  expect(style.minHeight).toBe('44px');
  expect(style.minWidth).toBe('44px');
}

describe('WordPage', () => {
  it('shows the word with a link to each of its kanji', async () => {
    const GET = mount(detail([kanjiLink('日'), kanjiLink('本')]));
    await screen.findByRole('heading', { name: '日本' });
    expect(GET).toHaveBeenCalledWith('/api/v1/items/{key}', {
      params: { path: { key: 'ja:word:日本:にほん' } },
    });
    screen.getByText('Japan');
    screen.getByText('(n)');
    screen.getByText('Stage 3');
    screen.getByText('I go to Japan.');
    expect(screen.getByRole('link', { name: '日' }).getAttribute('href')).toBe(
      '/library/kanji/ja%3Akanji%3A%E6%97%A5',
    );
    screen.getByRole('link', { name: '本' });
  });

  it('has 44 px back and kanji links (#263, IF-03)', async () => {
    mount(detail([kanjiLink('日')]));
    expectTapTarget(await screen.findByRole('link', { name: 'Library' }));
    expectTapTarget(screen.getByRole('link', { name: '日' }));
  });

  it('omits the kanji section for a kana word and says when not started', async () => {
    mount(detail([], null));
    await screen.findByText('Not started');
    expect(screen.queryByRole('heading', { name: 'Kanji' })).toBeNull();
  });

  it('shows a message for an item that is not a word', async () => {
    mount({ ...detail([]), type: 'kanji', data: { character: '日' } });
    await screen.findByRole('alert');
    screen.getByText('This item is not a word.');
  });
});

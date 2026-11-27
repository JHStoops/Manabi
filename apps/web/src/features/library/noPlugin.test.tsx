import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import { learnerSettingsSchema } from '@manabi/core';
import type { User } from '@manabi/core';
import '../../i18n';
import { AppThemeProvider } from '../../theme';
import { ActivePluginProvider } from '../../state/plugins';
import type { ReactNode } from 'react';
import { ApiContext, SessionProvider, useSession } from '../../state/session';
import CharacterLibraryPage from './CharacterLibraryPage';
import GrammarPointPage from './GrammarPointPage';
import WordPage from './WordPage';

// #263, FR-241, IF-03: the character grid and the word page say why they cannot show anything
// when the course plugin is known to be absent, instead of "Loading…" forever. The real
// ActivePluginProvider decides, from GET /me and GET /courses.

beforeAll(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

/** As the app does (App.tsx), render nothing until the signed-in learner is known. */
function SignedIn({ children }: { children: ReactNode }) {
  return useSession().status === 'loading' ? null : <>{children}</>;
}

type Case = 'no course' | 'unknown plugin' | 'courses fail';

const word = {
  id: 1,
  key: 'ja:word:水:みず',
  type: 'word',
  data: { written: '水', reading: 'みず', senses: [{ partsOfSpeech: ['n'], meanings: ['water'] }] },
  stage: null,
  facets: [],
  links: [],
  sentences: [],
};

function mount(page: 'characters' | 'word', which: Case) {
  const me = {
    id: 1,
    role: 'learner',
    settings: learnerSettingsSchema.parse({ activeCourseId: which === 'no course' ? null : 3 }),
  } as User;
  const GET = (url: string) => {
    if (url === '/api/v1/me') return Promise.resolve(me);
    if (url === '/api/v1/courses') {
      return which === 'courses fail'
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ courses: [{ id: 3, plugin: 'xx' }] });
    }
    if (url === '/api/v1/courses/{id}/path') return Promise.resolve({ sections: [] });
    if (url === '/api/v1/items/{key}') return Promise.resolve(word);
    return Promise.resolve({ items: [], nextCursor: null });
  };
  const path = page === 'word' ? '/library/words/ja%3Aword%3A%E6%B0%B4' : '/library/characters';
  render(
    <ApiContext.Provider value={{ GET } as unknown as ApiClient}>
      <SessionProvider>
        <SignedIn>
          <ActivePluginProvider>
            <AppThemeProvider>
              <MemoryRouter initialEntries={[path]}>
                <Routes>
                  <Route path="/library/characters" element={<CharacterLibraryPage />} />
                  <Route path="/library/words/:key" element={<WordPage />} />
                </Routes>
              </MemoryRouter>
            </AppThemeProvider>
          </ActivePluginProvider>
        </SignedIn>
      </SessionProvider>
    </ApiContext.Provider>,
  );
}

describe('without a course plugin (#263)', () => {
  it('the character grid asks for a course when there is none', async () => {
    mount('characters', 'no course');
    await screen.findByText('Choose a course on the Learn tab to see its characters.');
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it.each<Case>(['unknown plugin', 'courses fail'])(
    'the character grid says there is no character study: %s',
    async (which) => {
      mount('characters', which);
      await screen.findByText("This course's language has no character study.");
      expect(screen.queryByText('Loading…')).toBeNull();
    },
  );

  it.each<Case>(['no course', 'unknown plugin', 'courses fail'])(
    'the word page says it needs a course: %s',
    async (which) => {
      mount('word', which);
      await screen.findByText(
        'Words need an active course in a supported language. Choose one on the Learn tab.',
      );
      expect(screen.queryByText('Loading…')).toBeNull();
    },
  );
});

describe('44 px back links (#263, IF-03)', () => {
  function mountGrammar() {
    const point = {
      id: 1,
      key: 'ja:grammar:wa',
      type: 'grammar',
      levelCode: 'N5',
      data: { pattern: 'は', meaning: 'topic', formation: [], explanation: '' },
      stage: null,
      facets: [],
      links: [
        {
          kind: 'related',
          direction: 'outgoing',
          item: {
            id: 2,
            key: 'ja:grammar:ga',
            type: 'grammar',
            data: { pattern: 'が' },
            stage: null,
          },
        },
      ],
      sentences: [],
    };
    const GET = () => Promise.resolve(point);
    render(
      <ApiContext.Provider value={{ GET } as unknown as ApiClient}>
        <AppThemeProvider>
          <MemoryRouter initialEntries={['/library/grammar/ja%3Agrammar%3Awa']}>
            <Routes>
              <Route path="/library/grammar/:key" element={<GrammarPointPage />} />
            </Routes>
          </MemoryRouter>
        </AppThemeProvider>
      </ApiContext.Provider>,
    );
  }

  it('the grammar point page sizes its back link and related links', async () => {
    mountGrammar();
    for (const name of ['Grammar', 'が']) {
      const style = getComputedStyle(await screen.findByRole('link', { name }));
      expect(style.minHeight).toBe('44px');
      expect(style.minWidth).toBe('44px');
    }
  });
});

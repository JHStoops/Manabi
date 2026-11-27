import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import { learnerSettingsSchema } from '@manabi/core';
import type { User } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import '../../i18n';
import { AppThemeProvider } from '../../theme';
import { ActivePluginContext } from '../../state/plugins';
import { ApiContext, SessionProvider } from '../../state/session';
import GrammarPointPage from './GrammarPointPage';
import GrammarReferencePage from './GrammarReferencePage';
import { Markdown } from './Markdown';

// FR-090, FR-092

beforeAll(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const user = {
  id: 1,
  role: 'learner',
  settings: learnerSettingsSchema.parse({ activeCourseId: 3 }),
} as User;

const point = (key: string, level: string, stage: number | null, data: object) => ({
  id: 1,
  key,
  type: 'grammar',
  levelCode: level,
  stage,
  data,
});

const items = [
  point('ja:grammar:wa-desu', 'N5', 4, {
    pattern: 'A は B です',
    meaning: 'A is B',
    themes: ['particles'],
  }),
  point('ja:grammar:hazu', 'N4', null, {
    pattern: 'Verb + はず',
    meaning: 'should be',
    themes: [],
  }),
];

function mount(ui: React.ReactNode, get: (url: string, opts?: unknown) => unknown, path: string) {
  const api = {
    GET: (url: string, opts?: unknown) =>
      Promise.resolve(url === '/api/v1/me' ? user : get(url, opts)),
  } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <SessionProvider>
        <AppThemeProvider>
          <ActivePluginContext.Provider value={japanese}>
            <MemoryRouter initialEntries={[path]}>
              <Routes>
                <Route path="/library/grammar" element={ui} />
                <Route path="/library/grammar/:key" element={ui} />
              </Routes>
            </MemoryRouter>
          </ActivePluginContext.Provider>
        </AppThemeProvider>
      </SessionProvider>
    </ApiContext.Provider>,
  );
}

describe('GrammarReferencePage', () => {
  const list = (_: string, opts: unknown) => {
    const { q } = (opts as { params: { query: { q?: string } } }).params.query;
    return {
      items: q ? items.filter((i) => (i.data as { pattern: string }).pattern.includes(q)) : items,
      nextCursor: null,
    };
  };

  it('groups by level, toggles to theme and marks points not yet reached', async () => {
    mount(<GrammarReferencePage />, list, '/library/grammar');
    await screen.findByRole('heading', { name: 'N5' });
    screen.getByRole('heading', { name: 'N4' });
    expect(screen.getAllByText(/not yet learned/i)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'By theme' }));
    screen.getByRole('heading', { name: 'particles' });
    screen.getByRole('heading', { name: 'Other' });
    expect(screen.getByRole('link', { name: 'Verb + はず' }).getAttribute('href')).toBe(
      '/library/grammar/ja%3Agrammar%3Ahazu',
    );
  });

  it('gives each point link a 44 px tap target (#263, IF-03)', async () => {
    mount(<GrammarReferencePage />, list, '/library/grammar');
    const style = getComputedStyle(await screen.findByRole('link', { name: 'Verb + はず' }));
    expect(style.minHeight).toBe('44px');
    expect(style.minWidth).toBe('44px');
  });

  it('searches through the API', async () => {
    mount(<GrammarReferencePage />, list, '/library/grammar');
    await screen.findByRole('heading', { name: 'N5' });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'はず' } });
    await screen.findByText('should be');
    expect(screen.queryByText('A is B')).toBeNull();
  });
});

describe('GrammarPointPage', () => {
  const detail = {
    ...point('ja:grammar:wa-desu', 'N5', 4, {
      pattern: 'A は B です',
      meaning: 'A is B',
      formation: [{ wordType: 'Noun', form: 'N + です', example: '学生です' }],
      explanation: 'Says what **A** is.\n\n<script>alert(1)</script>Polite.',
    }),
    facets: [],
    links: [
      { kind: 'related', direction: 'outgoing', item: items[1] },
      { kind: 'contains', direction: 'incoming', item: items[1] },
    ],
    sentences: [
      {
        id: 1,
        text: '私は学生です。',
        translation: 'I am a student.',
        tokens: [{ surface: '私', base: '私', reading: 'わたし' }],
        attribution: null,
      },
    ],
  };

  it('shows header, formation, explanation, examples and related points', async () => {
    mount(<GrammarPointPage />, () => detail, '/library/grammar/ja:grammar:wa-desu');
    await screen.findByRole('heading', { name: 'A は B です' });
    screen.getByText('A is B');
    screen.getByText(/Level N5/);
    screen.getByText(/Familiar/);
    screen.getByRole('cell', { name: '学生です' });
    screen.getByText('A', { selector: 'strong' });
    screen.getByText('I am a student.');
    expect(screen.getAllByRole('link', { name: 'Verb + はず' })).toHaveLength(1);
    expect(document.querySelector('script')).toBeNull();
  });
});

const detail0 = () => ({ ...point('k', 'N4', null, {}), facets: [], links: [], sentences: [] });

describe('GrammarPointPage states', () => {
  it('shows a not-yet-learned stub without optional blocks', async () => {
    const stub = { ...detail0(), stage: null, data: { pattern: 'Verb + はず' } };
    mount(<GrammarPointPage />, () => stub, '/library/grammar/ja:grammar:hazu');
    await screen.findByRole('heading', { name: 'Verb + はず' });
    screen.getByText('Not yet learned');
    expect(screen.queryByRole('heading', { name: 'Formation' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Related' })).toBeNull();
  });
});

describe('Markdown', () => {
  it('keeps text that merely contains angle brackets', () => {
    const { container } = render(<Markdown source="A < B and <script>alert(1)" />);
    expect(container.textContent).toBe('A < B and');
  });

  it('drops script tags and their bodies', () => {
    const { container } = render(
      <Markdown source={'Hi <script>alert(1)</script> *there*\n\n- a\n- b'} />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).not.toContain('alert');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    screen.getByText('there', { selector: 'em' });
  });
});

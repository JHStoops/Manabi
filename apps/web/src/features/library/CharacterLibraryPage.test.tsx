import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import { learnerSettingsSchema } from '@manabi/core';
import type { LibraryItem, LibraryItemsQuery, User } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import '../../i18n';
import { AppThemeProvider } from '../../theme';
import { ActivePluginContext } from '../../state/plugins';
import { ApiContext, SessionProvider } from '../../state/session';
import CharacterLibraryPage, { itemsQuery } from './CharacterLibraryPage';

// FR-075, FR-102: the kanji and kana grid, its filters, search, stages and paging.

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

let nextId = 1;
const kanji = (
  character: string,
  meaning: string,
  level: string,
  strokeCount: number,
  radical: string,
  stage: number | null,
  readings: string[] = [],
): LibraryItem & { radical: string; strokeCount: number; readings: string[] } => ({
  id: nextId++,
  key: `ja:kanji:${character}`,
  type: 'kanji',
  levelCode: level,
  stage: stage as never,
  data: { character, meanings: [meaning], onReadings: readings, kunReadings: [], strokeCount },
  radical,
  strokeCount,
  readings,
});

const kana = (character: string, romaji: string, stage: number | null) => ({
  id: nextId++,
  key: `ja:kana:${character}`,
  type: 'kana',
  levelCode: 'N5',
  stage: stage as never,
  data: { character, script: 'hiragana', romaji },
  radical: '',
  strokeCount: 0,
  readings: [romaji],
});

const course = [
  kanji('水', 'water', 'N5', 4, '水', 2, ['スイ']),
  kanji('火', 'fire', 'N5', 4, '火', null, ['カ']),
  kanji('木', 'tree', 'N5', 4, '木', 6, ['モク']),
  kanji('海', 'sea', 'N4', 9, '水', 7, ['カイ']),
  kana('あ', 'a', 8),
  kana('か', 'ka', null),
];

const bands: Record<string, [number, number] | null> = {
  learning: [1, 3],
  familiar: [4, 5],
  strong: [6, 6],
  mastered: [7, 7],
  retired: [8, 8],
};

/** The server's filters, in memory: enough to show the page sends the right query. */
function serve(all: typeof course, q: LibraryItemsQuery) {
  return all.filter((i) => {
    const d = i.data as { character: string; meanings?: string[] };
    if (i.type !== q.type) return false;
    if (q.level && i.levelCode !== q.level) return false;
    if (q.strokeCount && i.strokeCount !== q.strokeCount) return false;
    if (q.radical && i.radical !== q.radical) return false;
    if (q.stage === 'not_started' && i.stage !== null) return false;
    if (q.stage && q.stage !== 'not_started') {
      const [lo, hi] = bands[q.stage]!;
      if (i.stage === null || i.stage < lo || i.stage > hi) return false;
    }
    if (q.q) {
      const terms = [d.character, ...(d.meanings ?? []), ...i.readings];
      if (!terms.some((t) => t.includes(q.q!))) return false;
    }
    return true;
  });
}

interface MountOptions {
  pageSize?: number;
  /** Holds back the responses it returns true for, until released. */
  hold?: (query: LibraryItemsQuery) => boolean;
  /** Fails the requests it returns true for. */
  fail?: (query: LibraryItemsQuery) => boolean;
  plugin?: typeof japanese | null;
  me?: User;
}

/** Held responses, oldest first; calling one delivers it. */
let held: (() => void)[] = [];
afterEach(() => {
  held = [];
});

function mount(items = course, options: MountOptions | number = {}) {
  const {
    pageSize = 100,
    hold = () => false,
    fail = () => false,
    plugin = japanese,
    me = user,
  } = typeof options === 'number' ? { pageSize: options } : options;
  const queries: LibraryItemsQuery[] = [];
  const api = {
    GET: (url: string, opts?: { params: { query: LibraryItemsQuery } }) => {
      if (url === '/api/v1/me') return Promise.resolve(me);
      if (url === '/api/v1/courses/{id}/path') {
        return Promise.resolve({
          sections: [{ levelCode: 'N5' }, { levelCode: 'N5' }, { levelCode: 'N4' }],
        });
      }
      const query = opts!.params.query;
      queries.push(query);
      if (fail(query)) {
        return Promise.reject({ error: { code: 'internal', message: 'boom', details: null } });
      }
      const matching = serve(items, query);
      const start = query.cursor ? Number(query.cursor) : 0;
      const end = start + Math.min(query.limit, pageSize);
      const page = {
        items: matching.slice(start, end),
        nextCursor: end < matching.length ? String(end) : null,
      };
      if (!hold(query)) return Promise.resolve(page);
      return new Promise((resolve) => held.push(() => resolve(page)));
    },
  } as unknown as ApiClient;
  render(
    <ApiContext.Provider value={api}>
      <SessionProvider>
        <AppThemeProvider>
          <ActivePluginContext.Provider value={plugin}>
            <MemoryRouter initialEntries={['/library/kanji']}>
              <Routes>
                <Route path="/library/kanji" element={<CharacterLibraryPage />} />
              </Routes>
            </MemoryRouter>
          </ActivePluginContext.Provider>
        </AppThemeProvider>
      </SessionProvider>
    </ApiContext.Provider>,
  );
  return queries;
}

const grid = () => screen.getByRole('list', { name: /Kanji|Kana/ });
const shown = () =>
  within(grid())
    .queryAllByRole('listitem')
    .map((li) => li.textContent?.charAt(0));

async function loaded(...characters: string[]) {
  await waitFor(() => expect(shown()).toEqual(characters));
}

describe('CharacterLibraryPage', () => {
  it("lists every kanji with its stage as text and ring, linking to the kanji's page", async () => {
    mount();
    await loaded('水', '火', '木', '海');
    const water = screen.getByRole('link', { name: '水, water, Learning' });
    expect(water.getAttribute('href')).toBe('/library/kanji/ja%3Akanji%3A%E6%B0%B4');
    // FR-102, NFR-31: the stage is in text, and the ring is drawn in the band's color.
    within(water).getByText('Learning');
    expect(water.querySelectorAll('circle')).toHaveLength(2);
    within(screen.getByRole('link', { name: '火, fire, Not started' })).getByText('Not started');
    expect(
      screen.getByRole('link', { name: '火, fire, Not started' }).querySelectorAll('circle'),
    ).toHaveLength(1);
  });

  it('gives the Library back link a 44 px tap target (#263, IF-03)', async () => {
    mount();
    const style = getComputedStyle(await screen.findByRole('link', { name: 'Library' }));
    expect(style.minHeight).toBe('44px');
    expect(style.minWidth).toBe('44px');
  });

  it('filters by level from the course path', async () => {
    const queries = mount();
    await loaded('水', '火', '木', '海');
    const level = screen.getByRole('combobox', { name: 'Level' });
    expect(
      within(level)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All levels', 'N5', 'N4']);
    fireEvent.change(level, { target: { value: 'N4' } });
    await loaded('海');
    expect(queries.at(-1)).toMatchObject({ type: 'kanji', level: 'N4' });
  });

  it('filters by stroke count', async () => {
    const queries = mount();
    await loaded('水', '火', '木', '海');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Strokes' }), {
      target: { value: '9' },
    });
    await loaded('海');
    expect(queries.at(-1)).toMatchObject({ strokeCount: 9 });
  });

  it('filters by radical', async () => {
    const queries = mount();
    await loaded('水', '火', '木', '海');
    fireEvent.change(screen.getByRole('textbox', { name: 'Radical' }), {
      target: { value: '水' },
    });
    await loaded('水', '海');
    expect(queries.at(-1)).toMatchObject({ radical: '水' });
  });

  it('filters by stage band, including not started', async () => {
    const queries = mount();
    await loaded('水', '火', '木', '海');
    const stage = screen.getByRole('combobox', { name: 'Stage' });
    fireEvent.change(stage, { target: { value: 'mastered' } });
    await loaded('海');
    fireEvent.change(stage, { target: { value: 'not_started' } });
    await loaded('火');
    expect(queries.at(-1)).toMatchObject({ stage: 'not_started' });
  });

  it.each([
    ['character', '木', ['木']],
    ['meaning', 'sea', ['海']],
    ['reading', 'カ', ['火', '海']],
  ])('searches by %s', async (_what, term, expected) => {
    const queries = mount();
    await loaded('水', '火', '木', '海');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: term },
    });
    await loaded(...expected);
    expect(queries.at(-1)).toMatchObject({ q: term });
  });

  it('combines filters with search and says when nothing matches', async () => {
    mount();
    await loaded('水', '火', '木', '海');
    fireEvent.change(screen.getByRole('combobox', { name: 'Level' }), {
      target: { value: 'N5' },
    });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: 'sea' },
    });
    await screen.findByText('No characters match.');
    expect(shown()).toEqual([]);
  });

  it('lists kana without the kanji-only filters, and kana tiles link to the kana page', async () => {
    const queries = mount();
    await loaded('水', '火', '木', '海');
    fireEvent.change(screen.getByRole('textbox', { name: 'Radical' }), {
      target: { value: '水' },
    });
    await loaded('水', '海');
    fireEvent.click(screen.getByRole('button', { name: 'Kana' }));
    await loaded('あ', 'か');
    screen.getByRole('heading', { name: 'Kana' });
    expect(screen.queryByRole('textbox', { name: 'Radical' })).toBeNull();
    expect(screen.queryByRole('spinbutton', { name: 'Strokes' })).toBeNull();
    expect(queries.at(-1)).toEqual(expect.objectContaining({ type: 'kana' }));
    expect(queries.at(-1)!.radical).toBeUndefined();
    expect(screen.getByRole('link', { name: 'あ, a, Retired' }).getAttribute('href')).toBe(
      '/library/kana/ja%3Akana%3A%E3%81%82',
    );
  });

  it('loads the next page when the grid reaches the end of what is loaded', async () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      kanji(String.fromCodePoint(0x4e00 + i), `k${i}`, 'N5', 1, '一', null),
    );
    const queries = mount(many, 2);
    await waitFor(() => expect(shown()).toHaveLength(5));
    expect(queries.map((q) => q.cursor)).toEqual([undefined, '2', '4']);
  });

  it('shows an API error and retries the first page', async () => {
    let failing = true;
    const queries = mount(course, { fail: () => failing });
    await screen.findByRole('alert');
    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await loaded('水', '火', '木', '海');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(queries).toHaveLength(2);
  });

  it('retries a failed later page instead of stalling', async () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      kanji(String.fromCodePoint(0x4e00 + i), `k${i}`, 'N5', 1, '一', null),
    );
    let failing = true;
    const queries = mount(many, { pageSize: 2, fail: (q) => failing && q.cursor === '2' });
    await screen.findByRole('alert');
    expect(shown()).toHaveLength(2);
    // The failed page is not asked for again on its own.
    await act(() => Promise.resolve());
    expect(queries.filter((q) => q.cursor === '2')).toHaveLength(1);
    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(shown()).toHaveLength(5));
  });

  it('drops a late response from an earlier round of the same query', async () => {
    let holding = true;
    mount(course, { hold: () => holding });
    // The kanji query is asked, then kana, then kanji again, before any answer arrives.
    await waitFor(() => expect(held).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Kana' }));
    await waitFor(() => expect(held).toHaveLength(2));
    holding = false;
    fireEvent.click(screen.getByRole('button', { name: 'Kanji' }));
    await loaded('水', '火', '木', '海');
    act(() => held.forEach((release) => release()));
    await act(() => Promise.resolve());
    expect(shown()).toEqual(['水', '火', '木', '海']);
  });

  it('keeps paging after a filter changes while a page is loading', async () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      kanji(String.fromCodePoint(0x4e00 + i), `k${i}`, 'N5', 1, i < 4 ? '一' : '二', null),
    );
    const queries = mount(many, { pageSize: 2, hold: (q) => q.cursor === '2' && !q.radical });
    await waitFor(() => expect(held).toHaveLength(1));
    fireEvent.change(screen.getByRole('textbox', { name: 'Radical' }), {
      target: { value: '一' },
    });
    await waitFor(() => expect(shown()).toHaveLength(4));
    act(() => held[0]!());
    await act(() => Promise.resolve());
    expect(shown()).toHaveLength(4);
    expect(queries.filter((q) => q.radical).map((q) => q.cursor)).toEqual([undefined, '2']);
  });

  it('is unavailable when the course plugin has no character study (FR-241)', async () => {
    mount(course, {
      plugin: { ...japanese, features: { ...japanese.features, characterStudy: false } },
    });
    await screen.findByText("This course's language has no character study.");
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('marks a stroke count it cannot filter by as invalid', async () => {
    const queries = mount();
    await loaded('水', '火', '木', '海');
    const strokes = screen.getByRole('spinbutton', { name: 'Strokes' });
    fireEvent.change(strokes, { target: { value: '0' } });
    expect(strokes.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(strokes, { target: { value: '4' } });
    expect(strokes.getAttribute('aria-invalid')).toBe('false');
    await loaded('水', '火', '木');
    expect(queries.every((q) => q.strokeCount === undefined || q.strokeCount === 4)).toBe(true);
  });

  it('caps the search at the length the API accepts', async () => {
    mount();
    await loaded('水', '火', '木', '海');
    expect(screen.getByRole('searchbox', { name: 'Search' }).getAttribute('maxlength')).toBe('100');
  });
});

describe('itemsQuery', () => {
  const none = { level: '', strokeCount: '', radical: '', stage: '' } as const;

  it('leaves out empty filters and those kana lack', () => {
    expect(itemsQuery(3, 'kanji', none, '  ')).toEqual({
      courseId: 3,
      type: 'kanji',
      limit: 100,
      level: undefined,
      strokeCount: undefined,
      radical: undefined,
      stage: undefined,
      q: undefined,
    });
    expect(
      itemsQuery(3, 'kana', { ...none, strokeCount: '4', radical: '水', level: 'N5' }, 'a'),
    ).toMatchObject({ type: 'kana', strokeCount: undefined, radical: undefined, level: 'N5' });
  });

  it('ignores a stroke count that is not a whole number from 1 to 100', () => {
    for (const strokeCount of ['0', '-2', '1.5', 'x', '101']) {
      expect(itemsQuery(3, 'kanji', { ...none, strokeCount }, '').strokeCount).toBeUndefined();
    }
    expect(itemsQuery(3, 'kanji', { ...none, strokeCount: '100' }, '').strokeCount).toBe(100);
  });
});

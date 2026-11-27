import { useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { STAGE_BANDS } from '@manabi/core';
import type { LibraryItem, LibraryItemsQuery, StageBand } from '@manabi/core';
import { ActivePluginContext, ActivePluginStatusContext } from '../../state/plugins';
import { useApi, useSettings } from '../../state/session';
import { tapTarget } from '../../theme';
import { apiErrorMessage } from '../auth/ui';
import { BackLink } from './BackLink';
import { ItemTile, bandOf } from './ItemTile';
import { VirtualGrid } from './VirtualGrid';

// FR-075, FR-102, Product Spec section 5 (Kanji library): every kanji in the course, or every
// kana, as tiles showing the learner's stage; filtered by level, stroke count, radical and stage,
// and searched by character, meaning or reading. The server filters and searches (GET /items).
// FR-241: the Library shows the entry here only when the course plugin has character study.

const Controls = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  label {
    display: flex;
    flex-direction: column;
    font-size: ${({ theme }) => theme.fontSizes.small};
    color: ${({ theme }) => theme.colors.textMuted};
  }
  input,
  select,
  button {
    ${({ theme }) => tapTarget(theme)};
    box-sizing: border-box;
    padding: 0 ${({ theme }) => theme.spacing(3)};
    border-radius: ${({ theme }) => theme.radii.small};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.body};
  }
  input[type='number'] {
    width: 6rem;
  }
  input[name='radical'] {
    width: 5rem;
  }
`;

const Kinds = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  width: 100%;
  button[aria-pressed='true'] {
    border-color: ${({ theme }) => theme.colors.primary};
    font-weight: 700;
  }
`;

const Cell = styled(Link)`
  ${({ theme }) => tapTarget(theme)};
  display: block;
  height: 100%;
  color: inherit;
  text-decoration: none;
  border-radius: ${({ theme }) => theme.radii.medium};
`;

// Cell sizes for the windowed grid: three columns fit a 360 px phone.
const CELL_WIDTH = 88;
const CELL_HEIGHT = 104;
const GAP = 8;
const PAGE_SIZE = 100;
const SEARCH_DELAY_MS = 300;

export type Kind = 'kanji' | 'kana';

interface Filters {
  level: string;
  strokeCount: string;
  radical: string;
  stage: StageBand | '';
}

const noFilters: Filters = { level: '', strokeCount: '', radical: '', stage: '' };

/**
 * The `GET /items` query for the grid's filters; filters a kind lacks, and a stroke count that is
 * not a whole number from 1 to 100 (the field shows it as invalid), are left out.
 */
export function itemsQuery(
  courseId: number,
  kind: Kind,
  filters: Filters,
  q: string,
): Omit<LibraryItemsQuery, 'cursor'> {
  const strokes = Number(filters.strokeCount);
  const kanji = kind === 'kanji';
  return {
    courseId,
    type: kind,
    limit: PAGE_SIZE,
    level: filters.level || undefined,
    strokeCount:
      kanji &&
      filters.strokeCount !== '' &&
      Number.isInteger(strokes) &&
      strokes >= 1 &&
      strokes <= 100
        ? strokes
        : undefined,
    radical: (kanji && filters.radical.trim()) || undefined,
    stage: filters.stage || undefined,
    q: q.trim() || undefined,
  };
}

interface ListState {
  /** The query the items belong to, as JSON. */
  forQuery: string;
  /**
   * Counts every 'start'. A response carries the generation it was asked in and is dropped
   * unless it still matches, even when a later round asked the very same query.
   */
  generation: number;
  items: LibraryItem[];
  nextCursor: string | null;
  loading: boolean;
  problem: string | null;
}

type ListAction =
  | { type: 'start'; forQuery: string }
  | { type: 'more' }
  | { type: 'page'; generation: number; items: LibraryItem[]; nextCursor: string | null }
  | { type: 'failed'; generation: number; problem: string };

const initialList: ListState = {
  forQuery: '',
  generation: 0,
  items: [],
  nextCursor: null,
  loading: true,
  problem: null,
};

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case 'start':
      return { ...initialList, forQuery: action.forQuery, generation: state.generation + 1 };
    case 'more':
      return { ...state, loading: true, problem: null };
    case 'page':
      if (action.generation !== state.generation) return state;
      return {
        ...state,
        items: [...state.items, ...action.items],
        nextCursor: action.nextCursor,
        loading: false,
      };
    case 'failed':
      if (action.generation !== state.generation) return state;
      return { ...state, loading: false, problem: action.problem };
  }
}

/** Waits until `value` has stopped changing for `ms`, so typing does not fire a search per key. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

// The item data the tiles read; the imported data is authoritative (see KanjiDetailPage).
const characterOf = (item: LibraryItem) =>
  item.data as unknown as { character: string; meanings?: string[]; romaji?: string };

export default function CharacterLibraryPage() {
  const { t } = useTranslation();
  const api = useApi();
  const { activeCourseId } = useSettings();
  const plugin = useContext(ActivePluginContext);
  const pluginStatus = useContext(ActivePluginStatusContext);
  const [kind, setKind] = useState<Kind>('kanji');
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [search, setSearch] = useState('');
  const q = useDebounced(search, SEARCH_DELAY_MS);
  const [levels, setLevels] = useState<string[]>([]);
  const [list, dispatch] = useReducer(listReducer, initialList);
  // The page last asked for, as "generation:cursor", so one page is never requested twice.
  const requested = useRef('');

  // The level filter offers the course's levels in section order.
  useEffect(() => {
    if (activeCourseId === null) return;
    let current = true;
    api.GET('/api/v1/courses/{id}/path', { params: { path: { id: String(activeCourseId) } } }).then(
      (path) => current && setLevels([...new Set(path.sections.map((s) => s.levelCode))]),
      // Without the path the level filter only offers "all levels"; the grid still works.
      () => current && setLevels([]),
    );
    return () => {
      current = false;
    };
  }, [api, activeCourseId]);

  const query = activeCourseId === null ? null : itemsQuery(activeCourseId, kind, filters, q);
  const queryKey = JSON.stringify(query);

  const fetchPage = useCallback(
    (forQuery: string, generation: number, cursor: string | undefined) => {
      const params = { ...(JSON.parse(forQuery) as LibraryItemsQuery), cursor };
      api.GET('/api/v1/items', { params: { query: params } }).then(
        (page) => dispatch({ type: 'page', generation, ...page }),
        (error) => dispatch({ type: 'failed', generation, problem: apiErrorMessage(t, error) }),
      );
    },
    [api, t],
  );

  // A new query starts a new generation; its first page is fetched once the reducer has it.
  useEffect(() => {
    if (queryKey !== 'null') dispatch({ type: 'start', forQuery: queryKey });
  }, [queryKey]);
  useEffect(() => {
    if (list.generation === 0 || list.items.length > 0 || !list.loading) return;
    const key = `${list.generation}:`;
    if (requested.current === key) return;
    requested.current = key;
    fetchPage(list.forQuery, list.generation, undefined);
  }, [list.generation, list.forQuery, list.items.length, list.loading, fetchPage]);

  /** The next page, or after a failure the page that failed. */
  const fetchNext = useCallback(() => {
    if (list.loading || list.nextCursor === null) return;
    requested.current = `${list.generation}:${list.nextCursor}`;
    dispatch({ type: 'more' });
    fetchPage(list.forQuery, list.generation, list.nextCursor);
  }, [list.loading, list.nextCursor, list.generation, list.forQuery, fetchPage]);

  const loadMore = useCallback(() => {
    // A failed page waits for the learner's Retry instead of being asked for in a loop.
    if (list.problem || requested.current === `${list.generation}:${list.nextCursor}`) return;
    fetchNext();
  }, [list.problem, list.generation, list.nextCursor, fetchNext]);

  const retry = () => {
    if (list.items.length === 0) {
      // The first page failed: ask for it again in a fresh generation.
      dispatch({ type: 'start', forQuery: list.forQuery });
    } else fetchNext();
  };

  // FR-241: only a course whose plugin has character study has this screen. With no plugin at all
  // (no active course or an unknown plugin) it is off, and a failed course load says so; never
  // "Loading…" forever.
  if (plugin === null && pluginStatus === 'none')
    return <p>{t(activeCourseId === null ? 'characters.noCourse' : 'characters.unavailable')}</p>;
  if (plugin === null && pluginStatus === 'error')
    return <p role="alert">{t('app.courseLoadFailed')}</p>;
  if (plugin === null) return <p>{t('app.loading')}</p>;
  if (!plugin.features.characterStudy) return <p>{t('characters.unavailable')}</p>;

  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const tileName = (item: LibraryItem) => {
    const c = characterOf(item);
    const gloss = item.type === 'kanji' ? c.meanings?.[0] : c.romaji;
    return [c.character, gloss, t(`stage.${bandOf(item.stage)}`)].filter(Boolean).join(', ');
  };
  const tile = (item: LibraryItem) => (
    <ItemTile label={characterOf(item).character} stage={item.stage} lang="ja" variant="grid" />
  );

  return (
    <>
      <BackLink to="/library">{t('area.library')}</BackLink>
      <h1>{t(`characters.title.${kind}`)}</h1>
      <Controls role="search" onSubmit={(e) => e.preventDefault()}>
        <Kinds>
          {(['kanji', 'kana'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {t(`characters.kind.${k}`)}
            </button>
          ))}
        </Kinds>
        <label>
          {t('characters.search')}
          <input
            type="search"
            maxLength={100}
            value={search}
            placeholder={t(`characters.searchHint.${kind}`)}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          {t('characters.level')}
          <select value={filters.level} onChange={(e) => set({ level: e.target.value })}>
            <option value="">{t('characters.allLevels')}</option>
            {levels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        {kind === 'kanji' && (
          <>
            <label>
              {t('characters.strokeCount')}
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                aria-invalid={filters.strokeCount !== '' && query?.strokeCount === undefined}
                value={filters.strokeCount}
                onChange={(e) => set({ strokeCount: e.target.value })}
              />
            </label>
            <label>
              {t('characters.radical')}
              <input
                name="radical"
                lang="ja"
                maxLength={8}
                value={filters.radical}
                onChange={(e) => set({ radical: e.target.value })}
              />
            </label>
          </>
        )}
        <label>
          {t('characters.stage')}
          <select
            value={filters.stage}
            onChange={(e) => set({ stage: e.target.value as StageBand | '' })}
          >
            <option value="">{t('characters.allStages')}</option>
            {(Object.keys(STAGE_BANDS) as StageBand[]).map((band) => (
              <option key={band} value={band}>
                {t(`stage.${band}`)}
              </option>
            ))}
          </select>
        </label>
      </Controls>

      {list.problem && (
        <p role="alert">
          {list.problem}{' '}
          <button type="button" onClick={retry}>
            {t('characters.retry')}
          </button>
        </p>
      )}
      {list.generation > 0 && !list.loading && !list.problem && list.items.length === 0 && (
        <p>{t('characters.none')}</p>
      )}
      <VirtualGrid
        items={list.items}
        itemKey={(item) => item.key}
        label={t(`characters.title.${kind}`)}
        minCellWidth={CELL_WIDTH}
        cellHeight={CELL_HEIGHT}
        gap={GAP}
        onNearEnd={loadMore}
        renderItem={(item) => (
          <Cell
            to={`/library/${item.type}/${encodeURIComponent(item.key)}`}
            aria-label={tileName(item)}
          >
            {tile(item)}
          </Cell>
        )}
      />
      {list.generation > 0 && list.loading && <p>{t('app.loading')}</p>}
    </>
  );
}

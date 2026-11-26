import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LibraryItem } from '@manabi/core';
import { useApi, useSettings } from '../../state/session';
import { tapTarget } from '../../theme';
import { apiErrorMessage } from '../auth/ui';
import { grammarOf } from './grammar';

// FR-092: every grammar point by level or theme, searchable by pattern and English meaning;
// points the learner has not reached are readable and marked.

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  input,
  button {
    ${({ theme }) => tapTarget(theme)};
    padding: 0 ${({ theme }) => theme.spacing(3)};
    border-radius: ${({ theme }) => theme.radii.small};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.body};
  }
`;

const List = styled.ul`
  list-style: none;
  margin: 0 0 ${({ theme }) => theme.spacing(4)};
  padding: 0;
  li {
    padding: ${({ theme }) => theme.spacing(2)} 0;
  }
`;

type Grouping = 'level' | 'theme';

export default function GrammarReferencePage() {
  const { t } = useTranslation();
  const api = useApi();
  const { activeCourseId } = useSettings();
  const [q, setQ] = useState('');
  const [grouping, setGrouping] = useState<Grouping>('level');
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (activeCourseId === null) return;
    let current = true;
    // shortcut: no debounce and every page fetched in turn; fine for a few hundred points.
    (async () => {
      const all: LibraryItem[] = [];
      let cursor: string | undefined;
      do {
        const query = {
          courseId: activeCourseId,
          type: 'grammar',
          limit: 100,
          q: q.trim() || undefined,
          cursor,
        };
        const page = await api.GET('/api/v1/items', { params: { query } });
        all.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      if (current) setItems(all);
    })().catch((err: unknown) => current && setProblem(apiErrorMessage(t, err)));
    return () => {
      current = false;
    };
  }, [api, activeCourseId, q, t]);

  const groups = new Map<string, LibraryItem[]>();
  for (const item of items ?? []) {
    const keys =
      grouping === 'level'
        ? [item.levelCode ?? t('grammar.noLevel')]
        : grammarOf(item).themes.length > 0
          ? grammarOf(item).themes
          : [t('grammar.noTheme')];
    for (const key of keys) groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <>
      <h1>{t('grammar.title')}</h1>
      <Controls>
        <input
          type="search"
          aria-label={t('grammar.search')}
          placeholder={t('grammar.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {(['level', 'theme'] as const).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={grouping === g}
            onClick={() => setGrouping(g)}
          >
            {t(`grammar.groupBy.${g}`)}
          </button>
        ))}
      </Controls>
      {problem && <p role="alert">{problem}</p>}
      {items?.length === 0 && <p>{t('grammar.none')}</p>}
      {[...groups].map(([group, points]) => (
        <section key={group}>
          <h2>{group}</h2>
          <List>
            {points.map((item) => {
              const { pattern, meaning } = grammarOf(item);
              return (
                <li key={item.key}>
                  <Link to={`/library/grammar/${encodeURIComponent(item.key)}`}>{pattern}</Link>
                  {meaning && <span> {meaning}</span>}
                  {item.stage === null && <em> {t('grammar.notYetLearnedTag')}</em>}
                </li>
              );
            })}
          </List>
        </section>
      ))}
    </>
  );
}

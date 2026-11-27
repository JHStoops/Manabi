import { useContext, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LibraryItem, LibraryItemDetail } from '@manabi/core';
import { tapTarget } from '../../theme';
import { useApi } from '../../state/session';
import { ActivePluginContext, ActivePluginStatusContext } from '../../state/plugins';
import { apiErrorMessage } from '../auth/ui';
import { ChoiceButton } from '../exercises/ui';
import { StrokeCanvas } from '../strokes/StrokeCanvas';
import { BackLink } from './BackLink';

// FR-070, FR-071, FR-241, Product Spec section 5 (Kanji library: "The same stroke animation, trace
// and draw features apply to kana"): one kana from GET /items/:key, with the kanji page's canvas.

const Page = styled.article`
  max-width: 40rem;
  margin: 0 auto;
  overflow-wrap: anywhere;
  section {
    margin-top: ${({ theme }) => theme.spacing(4)};
  }
  h2 {
    font-size: ${({ theme }) => theme.fontSizes.body};
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* IF-03: word links are tappable at 44 px. */
  li a {
    ${({ theme }) => tapTarget(theme)};
    display: inline-flex;
    align-items: center;
  }
`;

const Glyph = styled.span`
  font-size: 5rem;
  line-height: 1;
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(3)};
  p {
    margin: 0;
  }
`;

type Kana = { character: string; script: 'hiragana' | 'katakana'; romaji: string };

// The imported data is authoritative; the page only reads the fields it shows.
const kanaOf = (item: LibraryItem) => item.data as unknown as Kana;

export default function KanaDetailPage() {
  const { key = '' } = useParams();
  const { t } = useTranslation();
  const api = useApi();
  const plugin = useContext(ActivePluginContext);
  const pluginStatus = useContext(ActivePluginStatusContext);
  const [item, setItem] = useState<LibraryItemDetail | null>(null);
  const [problem, setProblem] = useState('');
  const [practice, setPractice] = useState(false);

  useEffect(() => {
    let current = true;
    setItem(null);
    setProblem('');
    setPractice(false);
    api.GET('/api/v1/items/{key}', { params: { path: { key } } }).then(
      (found) => current && setItem(found),
      (error) => current && setProblem(apiErrorMessage(t, error)),
    );
    return () => {
      current = false;
    };
  }, [api, key, t]);

  if (problem) return <p role="alert">{problem}</p>;
  // FR-241: no plugin at all (no course, unknown plugin, courses failed) means character study is off.
  if (plugin === null && pluginStatus === 'none') return <p>{t('characters.unavailable')}</p>;
  if (plugin === null && pluginStatus === 'error')
    return <p role="alert">{t('app.courseLoadFailed')}</p>;
  if (plugin === null || !item) return <p>{t('app.loading')}</p>;
  // FR-241: character study features only for a plugin that enables them.
  if (!plugin.features.characterStudy) return <p>{t('characters.unavailable')}</p>;
  if (item.type !== 'kana') return <p role="alert">{t('library.notKana')}</p>;

  const kana = kanaOf(item);
  if (typeof kana.character !== 'string') return <p role="alert">{t('library.notKana')}</p>;
  const stage =
    item.stage === null ? t('library.notStarted') : t('library.stage', { stage: item.stage });
  const words = item.links
    .filter((l) => l.kind === 'contains' && l.direction === 'incoming')
    .map((l) => l.item)
    .sort((a, b) => Number(b.stage !== null) - Number(a.stage !== null));
  // Stroke data is per single character; a digraph such as きゃ has no canvas.
  const hasCanvas = [...kana.character].length === 1;

  return (
    <Page>
      <BackLink to="/library">{t('area.library')}</BackLink>
      <Header>
        <Glyph lang="ja">{kana.character}</Glyph>
        <div>
          <h1>{kana.romaji}</h1>
          <p>{[t(`library.script.${kana.script}`), stage].join(' · ')}</p>
        </div>
      </Header>

      {hasCanvas && (
        <section aria-labelledby="a-strokes">
          <h2 id="a-strokes">{t('library.strokeOrder')}</h2>
          <StrokeCanvas
            itemKey={item.key}
            character={kana.character}
            mode={practice ? 'trace' : 'animate'}
          />
          <ChoiceButton type="button" onClick={() => setPractice(!practice)}>
            {t(practice ? 'library.watchAnimation' : 'library.practiceDrawing')}
          </ChoiceButton>
        </section>
      )}

      {words.length > 0 && (
        <section aria-labelledby="a-words">
          <h2 id="a-words">{t('library.words')}</h2>
          <ul>
            {words.map((w) => {
              const word = w.data as {
                written: string;
                reading: string;
                senses: { meanings: string[] }[];
              };
              return (
                <li key={w.key}>
                  <Link to={`/library/words/${encodeURIComponent(w.key)}`}>
                    <span lang="ja">{word.written}</span>
                  </Link>{' '}
                  <span lang="ja">{word.reading}</span> {word.senses[0]?.meanings.join(', ')}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Page>
  );
}

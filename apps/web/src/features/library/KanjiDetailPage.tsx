import { useContext, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LibraryItem, LibraryItemDetail } from '@manabi/core';
import { useApi } from '../../state/session';
import { ActivePluginContext } from '../../state/plugins';
import { SpeakerButton } from '../audio/SpeakerButton';
import { SpeechProvider } from '../audio/speech';
import { apiErrorMessage } from '../auth/ui';
import { ChoiceButton } from '../exercises/ui';
import { StrokeCanvas } from '../strokes/StrokeCanvas';
import { AnnotatedText } from '../text/AnnotatedText';

// FR-070, FR-071, Product Spec section 5 (Kanji detail page): one kanji from GET /items/:key.
// The My note block is not part of FR-070 and comes with its own issue.

const Page = styled.article`
  max-width: 40rem;
  margin: 0 auto;
  /* NFR: no horizontal scroll at 360 px; long meanings and readings wrap. */
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
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing(2)};
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

const Okurigana = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
`;

// NFR-31: the first-taught reading is marked by weight and an accessible label, not color alone.
const Reading = styled.li`
  &[data-first='true'] {
    font-weight: bold;
  }
`;

type Kanji = {
  character: string;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  strokeCount: number;
  components: string[];
};

// The imported data is authoritative; the page only reads the fields it shows.
const kanjiOf = (item: LibraryItem) => item.data as unknown as Kanji;

/** KANJIDIC2 marks okurigana with '.': た.べる is た then べる. */
function ReadingText({ value }: { value: string }) {
  const [stem, okurigana] = value.split('.');
  return (
    <>
      {stem}
      {okurigana !== undefined && <Okurigana>{okurigana}</Okurigana>}
    </>
  );
}

export default function KanjiDetailPage() {
  const { key = '' } = useParams();
  const { t } = useTranslation();
  const api = useApi();
  const plugin = useContext(ActivePluginContext);
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
  if (!item) return <p>{t('app.loading')}</p>;
  if (item.type !== 'kanji') return <p role="alert">{t('library.notKanji')}</p>;

  const kanji = kanjiOf(item);
  const stage = (it: LibraryItem) =>
    it.stage === null ? t('library.notStarted') : t('library.stage', { stage: it.stage });
  const linked = (kind: string, direction: string) =>
    item.links.filter((l) => l.kind === kind && l.direction === direction).map((l) => l.item);
  const components = linked('component', 'outgoing');
  const linkedChars = new Set(components.map((c) => kanjiOf(c).character));
  // Words the learner has started come first (Product Spec section 5).
  const words = linked('contains', 'incoming').sort(
    (a, b) => Number(b.stage !== null) - Number(a.stage !== null),
  );
  // shortcut: the first listed reading stands in for the one taught first, until lessons record it.
  const [firstReading] = [...kanji.onReadings, ...kanji.kunReadings];
  const readings = (label: string, list: string[]) =>
    list.length > 0 && (
      <>
        <h3>{label}</h3>
        <ul>
          {list.map((r) => (
            <Reading key={r} lang="ja" data-first={r === firstReading}>
              <ReadingText value={r} />
              {r === firstReading && ` (${t('library.firstTaught')})`}
            </Reading>
          ))}
        </ul>
      </>
    );

  return (
    <Page>
      <Link to="/library">{t('area.library')}</Link>
      <Header>
        <Glyph lang="ja">{kanji.character}</Glyph>
        <div>
          <h1>{kanji.meanings[0]}</h1>
          <p>
            {[item.levelCode, t('library.strokeCount', { count: kanji.strokeCount }), stage(item)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </Header>

      <section aria-labelledby="k-strokes">
        <h2 id="k-strokes">{t('library.strokeOrder')}</h2>
        <StrokeCanvas
          itemKey={item.key}
          character={kanji.character}
          mode={practice ? 'trace' : 'animate'}
        />
        <ChoiceButton type="button" onClick={() => setPractice(!practice)}>
          {t(practice ? 'library.watchAnimation' : 'library.practiceDrawing')}
        </ChoiceButton>
      </section>

      <section aria-labelledby="k-meanings">
        <h2 id="k-meanings">{t('library.meanings')}</h2>
        <p>{kanji.meanings.join(', ')}</p>
      </section>

      <section aria-labelledby="k-readings">
        <h2 id="k-readings">{t('library.readings')}</h2>
        {readings(t('library.on'), kanji.onReadings)}
        {readings(t('library.kun'), kanji.kunReadings)}
      </section>

      {(components.length > 0 || kanji.components.length > 0) && (
        <section aria-labelledby="k-components">
          <h2 id="k-components">{t('library.components')}</h2>
          <ul>
            {/* The importer lists the radical first (kanjidic2.ts); parts that are course kanji link. */}
            {[...new Set([...kanji.components, ...linkedChars])].map((c, i) => {
              const part = components.find((p) => kanjiOf(p).character === c);
              const radical = i === 0 && kanji.components[0] === c;
              return (
                <li key={c} lang="ja">
                  {part ? <Link to={`/library/kanji/${part.key}`}>{c}</Link> : c}
                  {radical && <span lang="en">{` (${t('library.radical')})`}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="k-words">
        <h2 id="k-words">{t('library.words')}</h2>
        <SpeechProvider locale={plugin?.ttsVoice.locale ?? ''}>
          <ul>
            {words.map((w) => {
              const word = w.data as {
                written: string;
                reading: string;
                senses: { meanings: string[] }[];
              };
              return (
                <li key={w.key}>
                  <span lang="ja">{word.written}</span> <span lang="ja">{word.reading}</span>{' '}
                  {[word.senses[0]?.meanings.join(', '), stage(w)].join(' · ')}{' '}
                  <SpeakerButton reading={word.reading} what="word" />
                </li>
              );
            })}
          </ul>
        </SpeechProvider>
      </section>

      {item.sentences.length > 0 && (
        <section aria-labelledby="k-sentences">
          <h2 id="k-sentences">{t('library.sentences')}</h2>
          <ul>
            {item.sentences.map((s) => (
              <li key={s.id}>
                <p>
                  {plugin ? (
                    // shortcut: furigana as if nothing were learned; wire the learner's items when #56 loads them.
                    <AnnotatedText plugin={plugin} tiles={s.tokens} learnedItems={[]} />
                  ) : (
                    s.text
                  )}
                </p>
                <p>{s.translation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}

import { useContext, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LibraryItemDetail } from '@manabi/core';
import { SpeakerButtons } from '../audio/SpeakerButton';
import { SpeechProvider } from '../audio/speech';
import { apiErrorMessage } from '../auth/ui';
import { AnnotatedText } from '../text/AnnotatedText';
import { ActivePluginContext, ActivePluginStatusContext } from '../../state/plugins';
import { tapTarget } from '../../theme';
import { BackLink } from './BackLink';
import { useApi } from '../../state/session';

// FR-100: reading, meanings, part of speech, audio, an example sentence and links to the
// word's kanji, plus the learner's stage (FR-102). Rules: Product Spec section 8.
// IF-03: the kanji links are 44 px tap targets.
const KanjiList = styled.ul`
  li a {
    ${({ theme }) => tapTarget(theme)};
    display: inline-flex;
    align-items: center;
  }
`;

export default function WordPage() {
  const { t } = useTranslation();
  const api = useApi();
  const plugin = useContext(ActivePluginContext);
  const pluginStatus = useContext(ActivePluginStatusContext);
  const { key = '' } = useParams();
  const [item, setItem] = useState<LibraryItemDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setItem(null);
    setProblem(null);
    api.GET('/api/v1/items/{key}', { params: { path: { key } } }).then(
      (found) => current && setItem(found),
      (err) => current && setProblem(apiErrorMessage(t, err)),
    );
    return () => {
      current = false;
    };
  }, [api, key, t]);

  if (problem) return <p role="alert">{problem}</p>;
  // The page needs the course plugin (its voice and reading annotations); without one it says so.
  if (plugin === null && pluginStatus === 'none') return <p>{t('library.wordUnavailable')}</p>;
  if (plugin === null && pluginStatus === 'error')
    return <p role="alert">{t('app.courseLoadFailed')}</p>;
  if (!item || !plugin) return <p>{t('app.loading')}</p>;
  // A key of another item type (a stale link) has no word data to show.
  if (item.type !== 'word') return <p role="alert">{t('library.notAWord')}</p>;

  const { written, reading, senses } = item.data as {
    written: string;
    reading: string;
    senses: { partsOfSpeech: string[]; meanings: string[] }[];
  };
  const kanji = item.links.filter((l) => l.direction === 'outgoing' && l.item.type === 'kanji');
  const sentence = item.sentences[0];

  return (
    <SpeechProvider locale={plugin.ttsVoice.locale}>
      <BackLink to="/library">{t('area.library')}</BackLink>
      <h1 lang={plugin.code}>{written}</h1>
      <p lang={plugin.code}>
        {reading}{' '}
        <SpeakerButtons reading={reading} what="word" owner={{ type: 'item', id: item.id }} />
      </p>
      <p>
        {item.stage !== null ? t('library.stage', { stage: item.stage }) : t('library.notStarted')}
      </p>
      <ol>
        {senses.map((s, i) => (
          <li key={i}>
            {s.meanings.join('; ')}
            {s.partsOfSpeech.length > 0 && (
              <small> {t('library.partOfSpeech', { pos: s.partsOfSpeech.join(', ') })}</small>
            )}
          </li>
        ))}
      </ol>
      {sentence && (
        <section aria-labelledby="word-example">
          <h2 id="word-example">{t('library.example')}</h2>
          {/* shortcut: no learned-item list yet, so "learned only" furigana shows every reading;
              feed it the learner's stage 4+ items once the library API exposes them. */}
          <AnnotatedText plugin={plugin} tiles={sentence.tokens} learnedItems={[]} />{' '}
          <SpeakerButtons
            reading={plugin.readingOf(sentence.tokens)}
            what="example"
            owner={{ type: 'sentence', id: sentence.id }}
          />
          <p>{sentence.translation}</p>
        </section>
      )}
      {kanji.length > 0 && (
        <section aria-labelledby="word-kanji">
          <h2 id="word-kanji">{t('library.kanji')}</h2>
          <KanjiList>
            {kanji.map(({ item: k }) => (
              <li key={k.key}>
                <Link to={`/library/kanji/${encodeURIComponent(k.key)}`} lang={plugin.code}>
                  {String(k.data.character)}
                </Link>
              </li>
            ))}
          </KanjiList>
        </section>
      )}
    </SpeechProvider>
  );
}

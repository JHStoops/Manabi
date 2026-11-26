import { useContext, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LibraryItemDetail } from '@manabi/core';
import { SpeakerButton } from '../audio/SpeakerButton';
import { SpeechProvider } from '../audio/speech';
import { apiErrorMessage } from '../auth/ui';
import { AnnotatedText } from '../text/AnnotatedText';
import { ActivePluginContext } from '../../state/plugins';
import { useApi } from '../../state/session';

// FR-100: reading, meanings, part of speech, audio, an example sentence and links to the
// word's kanji, plus the learner's stage (FR-102). Rules: Product Spec section 8.
export default function WordPage() {
  const { t } = useTranslation();
  const api = useApi();
  const plugin = useContext(ActivePluginContext);
  const { key = '' } = useParams();
  const [item, setItem] = useState<LibraryItemDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setItem(null);
    setProblem(null);
    api
      .GET('/api/v1/items/{key}', { params: { path: { key } } })
      .then(setItem, (err) => setProblem(apiErrorMessage(t, err)));
  }, [api, key, t]);

  if (problem) return <p role="alert">{problem}</p>;
  if (!item || !plugin) return <p>{t('app.loading')}</p>;

  const { written, reading, senses } = item.data as {
    written: string;
    reading: string;
    senses: { partsOfSpeech: string[]; meanings: string[] }[];
  };
  const kanji = item.links.filter((l) => l.direction === 'outgoing' && l.item.type === 'kanji');
  const sentence = item.sentences[0];

  return (
    <SpeechProvider locale={plugin.ttsVoice.locale}>
      <h1 lang={plugin.code}>{written}</h1>
      <p lang={plugin.code}>
        {reading} <SpeakerButton reading={reading} what="word" />
      </p>
      <p>{item.stage ? t('library.stage', { stage: item.stage }) : t('library.notStarted')}</p>
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
          <SpeakerButton reading={sentence.tokens.map((x) => x.reading).join('')} what="example" />
          <p>{sentence.translation}</p>
        </section>
      )}
      {kanji.length > 0 && (
        <section aria-labelledby="word-kanji">
          <h2 id="word-kanji">{t('library.kanji')}</h2>
          <ul>
            {kanji.map(({ item: k }) => (
              <li key={k.key}>
                <Link to={`/library/kanji/${encodeURIComponent(k.key)}`} lang={plugin.code}>
                  {String(k.data.character)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </SpeechProvider>
  );
}

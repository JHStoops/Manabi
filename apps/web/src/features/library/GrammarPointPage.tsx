import { useContext, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LibraryItemDetail } from '@manabi/core';
import { useApi } from '../../state/session';
import { ActivePluginContext } from '../../state/plugins';
import { SpeechProvider } from '../audio/speech';
import { SpeakerButton } from '../audio/SpeakerButton';
import { apiErrorMessage } from '../auth/ui';
import { AnnotatedText } from '../text/AnnotatedText';
import { grammarOf, stageName } from './grammar';
import { Markdown } from './Markdown';

// FR-090: pattern header, formation table, explanation, examples with audio and furigana, and
// related points (Product Spec section 6).
// shortcut: the matched pattern is not highlighted in examples (sentences store no match span),
// and word tap cards are not built; add both when sentences carry detection spans.

const Table = styled.table`
  border-collapse: collapse;
  th,
  td {
    border: 1px solid ${({ theme }) => theme.colors.border};
    padding: ${({ theme }) => theme.spacing(2)};
    text-align: left;
  }
`;

export default function GrammarPointPage() {
  const plugin = useContext(ActivePluginContext);
  return (
    <SpeechProvider locale={plugin?.ttsVoice.locale ?? ''}>
      <GrammarPoint />
    </SpeechProvider>
  );
}

function GrammarPoint() {
  const { t } = useTranslation();
  const api = useApi();
  const { key = '' } = useParams();
  const plugin = useContext(ActivePluginContext);
  const [item, setItem] = useState<LibraryItemDetail | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setItem(null);
    api.GET('/api/v1/items/{key}', { params: { path: { key } } }).then(
      (body) => current && setItem(body),
      (err: unknown) => current && setProblem(apiErrorMessage(t, err)),
    );
    return () => {
      current = false;
    };
  }, [api, key, t]);

  if (problem) return <p role="alert">{problem}</p>;
  if (!item) return <p>{t('app.loading')}</p>;

  const { pattern, meaning, formation, explanation } = grammarOf(item);
  const related = [
    ...new Map(
      item.links
        .filter((l) => l.kind === 'related' && l.item.type === 'grammar')
        .map((l) => [l.item.key, l.item]),
    ).values(),
  ];
  return (
    <>
      <p>
        <Link to="/library/grammar">{t('grammar.title')}</Link>
      </p>
      <header>
        <h1 lang={plugin?.code}>{pattern}</h1>
        {meaning && <p>{meaning}</p>}
        <p>
          {item.levelCode && <span>{t('grammar.level', { level: item.levelCode })}</span>}
          {item.stage === null
            ? t('grammar.notYetLearned')
            : t(`grammar.stage.${stageName(item.stage)}`)}
        </p>
      </header>
      {formation.length > 0 && (
        <section>
          <h2>{t('grammar.formation')}</h2>
          <Table>
            <thead>
              <tr>
                <th>{t('grammar.wordType')}</th>
                <th>{t('grammar.form')}</th>
                <th>{t('grammar.example')}</th>
              </tr>
            </thead>
            <tbody>
              {formation.map((row) => (
                <tr key={row.wordType}>
                  <td>{row.wordType}</td>
                  <td lang={plugin?.code}>{row.form}</td>
                  <td lang={plugin?.code}>{row.example}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}
      {explanation && (
        <section>
          <h2>{t('grammar.explanation')}</h2>
          <Markdown source={explanation} />
        </section>
      )}
      {item.sentences.length > 0 && (
        <section>
          <h2>{t('grammar.examples')}</h2>
          <ul>
            {item.sentences.map((s) => (
              <li key={s.id}>
                {plugin ? (
                  // shortcut: no learned-items list here, so furigana "unlearned only" shows all.
                  <AnnotatedText plugin={plugin} tiles={s.tokens} learnedItems={[]} />
                ) : (
                  s.text
                )}
                {plugin && <SpeakerButton what="example" reading={plugin.readingOf(s.tokens)} />}
                <br />
                {s.translation}
              </li>
            ))}
          </ul>
        </section>
      )}
      {related.length > 0 && (
        <section>
          <h2>{t('grammar.related')}</h2>
          <ul>
            {related.map((point) => (
              <li key={point.key}>
                <Link to={`/library/grammar/${encodeURIComponent(point.key)}`}>
                  {grammarOf(point).pattern}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

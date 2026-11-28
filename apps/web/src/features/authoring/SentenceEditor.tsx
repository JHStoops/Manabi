import styled from '@emotion/styled';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AttributionPart,
  AuthoringSentence,
  AuthoringSentenceSummary,
  ReviewStatus,
  Tile,
} from '@manabi/core';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';
import { Button, Form, Section } from '../admin/ui';
import { RecordingUpload } from './RecordingUpload';

// FR-059, FR-236, FR-237, FR-238, DR-11, Product Spec section 11 (Content editor): find a
// sentence, fix its tiles (split, merge, base form, reading, the highlighted pattern), set its
// review status and override its challenge status. The server segments text and detects
// grammar; this editor never runs an analyzer.

const STATUSES: ReviewStatus[] = ['unreviewed', 'flagged', 'reviewed'];

const TileList = styled.ol`
  display: grid;
  gap: ${({ theme }) => theme.spacing(1)};
  padding-left: ${({ theme }) => theme.spacing(5)};

  input,
  select {
    min-height: 44px;
  }
`;

/** Splits tile `i` after `at` characters. The new tiles' base and reading are left to the author. */
export function splitTile(tiles: readonly Tile[], i: number, at: number): Tile[] {
  const { surface, reading, pattern } = tiles[i]!;
  const parts = [surface.slice(0, at), surface.slice(at)];
  // A kana tile reads as written, so its reading splits the same way.
  const readings = reading === surface ? parts : [reading, parts[1]!];
  const split = parts.map((part, k): Tile => ({
    surface: part,
    base: part,
    reading: readings[k]!,
    ...(pattern ? { pattern } : {}),
  }));
  return [...tiles.slice(0, i), ...split, ...tiles.slice(i + 1)];
}

/** Merges tile `i` with the next; the merged tile keeps the second tile's base form ending. */
export function mergeTiles(tiles: readonly Tile[], i: number): Tile[] {
  const a = tiles[i]!;
  const b = tiles[i + 1]!;
  const merged: Tile = {
    surface: a.surface + b.surface,
    base: a.surface + b.base,
    reading: a.reading + b.reading,
    ...(a.pattern || b.pattern ? { pattern: true } : {}),
  };
  return [...tiles.slice(0, i), merged, ...tiles.slice(i + 2)];
}

export function SentenceEditor({ courseId }: { courseId: number }) {
  const { t } = useTranslation();
  const api = useApi();
  const [filter, setFilter] = useState({ q: '', grammar: '', status: '' });
  const [draft, setDraft] = useState({ text: '', translation: '' });
  const [found, setFound] = useState<AuthoringSentenceSummary[] | null>(null);
  const [open, setOpen] = useState<AuthoringSentence | null>(null);
  const [message, setMessage] = useState('');

  async function run<T>(request: Promise<T>, then: (value: T) => void) {
    setMessage('');
    try {
      then(await request);
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
    }
  }

  function find(event: FormEvent) {
    event.preventDefault();
    const query = {
      course: String(courseId),
      ...(filter.q ? { q: filter.q } : {}),
      ...(filter.grammar ? { grammar: filter.grammar } : {}),
      ...(filter.status ? { status: filter.status as ReviewStatus } : {}),
    };
    void run(api.GET('/api/v1/authoring/sentences', { params: { query } }), (body) =>
      setFound(body.sentences),
    );
  }

  function create(event: FormEvent) {
    event.preventDefault();
    void run(
      api.POST('/api/v1/authoring/sentences', { body: { course: courseId, ...draft } }),
      (created) => {
        setOpen(created);
        setDraft({ text: '', translation: '' });
      },
    );
  }

  const show = (id: number) =>
    void run(
      api.GET('/api/v1/authoring/sentences/{id}', { params: { path: { id: String(id) } } }),
      setOpen,
    );

  return (
    <Section aria-labelledby="authoring-sentences">
      <h2 id="authoring-sentences">{t('authoring.sentences.heading')}</h2>
      <Form onSubmit={find} role="search">
        <label>
          {t('authoring.sentences.search')}
          <input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        </label>
        <label>
          {t('authoring.sentences.grammarKey')}
          <input
            value={filter.grammar}
            onChange={(e) => setFilter({ ...filter, grammar: e.target.value })}
          />
        </label>
        <label>
          {t('authoring.sentences.statusFilter')}
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="">{t('authoring.sentences.anyStatus')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`authoring.sentences.reviewStatus.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">{t('authoring.sentences.find')}</Button>
      </Form>
      <Form onSubmit={create} aria-label={t('authoring.sentences.create')}>
        <label>
          {t('authoring.sentences.newText')}
          <input
            required
            value={draft.text}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          />
        </label>
        <label>
          {t('authoring.sentences.newTranslation')}
          <input
            required
            value={draft.translation}
            onChange={(e) => setDraft({ ...draft, translation: e.target.value })}
          />
        </label>
        <Button type="submit">{t('authoring.sentences.create')}</Button>
      </Form>
      {message && <p role="alert">{message}</p>}
      {found && found.length === 0 && <p>{t('authoring.sentences.none')}</p>}
      {found && found.length > 0 && (
        <ul aria-label={t('authoring.sentences.results')}>
          {found.map((s) => (
            <li key={s.id}>
              <Button type="button" onClick={() => show(s.id)}>
                {s.text}
              </Button>{' '}
              {t('authoring.sentences.summary', {
                translation: s.translation,
                status: t(`authoring.sentences.reviewStatus.${s.reviewStatus}`),
              })}
              {s.challenging && t('authoring.sentences.challengingMark')}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <SentenceForm
          key={`${open.sentence.id}:${JSON.stringify(open.sentence)}`}
          value={open}
          onSaved={setOpen}
        />
      )}
      {/* FR-132: an author's recording replaces the generated clip. */}
      {open && (
        <RecordingUpload
          key={`audio-${open.sentence.id}:${JSON.stringify(open.sentence.tokens)}`}
          ownerType="sentence"
          ownerId={open.sentence.id}
        />
      )}
    </Section>
  );
}

function SentenceForm({
  value,
  onSaved,
}: {
  value: AuthoringSentence;
  onSaved: (s: AuthoringSentence) => void;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const { sentence } = value;
  const [text, setText] = useState(sentence.text);
  const [translation, setTranslation] = useState(sentence.translation);
  const [tiles, setTiles] = useState<Tile[]>(sentence.tokens);
  const [reviewStatus, setReviewStatus] = useState(sentence.reviewStatus);
  const [challenge, setChallenge] = useState(
    sentence.challengeOverride === null ? '' : String(sentence.challengeOverride),
  );
  const [message, setMessage] = useState('');
  const yesNo = (v: boolean) => t(v ? 'authoring.sentences.yes' : 'authoring.sentences.no');

  async function save(resegment: boolean) {
    setMessage('');
    const body = {
      text,
      translation,
      reviewStatus,
      challengeOverride: challenge === '' ? null : challenge === 'true',
      ...(resegment ? { resegment } : { tiles }),
    };
    try {
      onSaved(
        await api.PATCH('/api/v1/authoring/sentences/{id}', {
          params: { path: { id: String(sentence.id) } },
          body,
        }),
      );
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void save(false);
  }

  // An undefined field in the patch is removed (JSON drops it), as the strict tile schema needs.
  const setTile = (i: number, patch: Partial<Tile>) =>
    setTiles((ts) => ts.map((tile, k) => (k === i ? { ...tile, ...patch } : tile)));

  const part = (side: 'sentence' | 'translation', p: AttributionPart, edited: boolean) =>
    t('authoring.sentences.attribution', {
      side: t(
        side === 'sentence'
          ? 'authoring.sentences.sideSentence'
          : 'authoring.sentences.sideTranslation',
      ),
      source: sentence.source,
      id: p.sourceId,
      owner: p.owner ?? t('authoring.sentences.noOwner'),
      licence: p.licence,
      version: p.datasetVersion,
      edited: edited ? t('authoring.sentences.editedMark') : '',
    });

  return (
    <form onSubmit={submit} aria-labelledby="authoring-sentence">
      <h3 id="authoring-sentence">{sentence.text}</h3>
      {sentence.attribution ? (
        <ul>
          <li>
            <a href={sentence.attribution.sentence.url}>
              {part('sentence', sentence.attribution.sentence, sentence.edited)}
            </a>
          </li>
          <li>
            <a href={sentence.attribution.translation.url}>
              {part('translation', sentence.attribution.translation, sentence.translationEdited)}
            </a>
          </li>
        </ul>
      ) : (
        <p>{t('authoring.sentences.authored')}</p>
      )}
      {value.blockedWords.length > 0 && (
        <p role="alert">
          {t('authoring.sentences.blockedWords', { words: value.blockedWords.join(', ') })}
        </p>
      )}
      <p>
        {sentence.grammar.length > 0
          ? t('authoring.sentences.grammar', { keys: sentence.grammar.join(', ') })
          : t('authoring.sentences.noGrammar')}{' '}
        {t('authoring.sentences.levels', {
          grammar: sentence.grammarLevelCode ?? '—',
          vocab: sentence.vocabLevelCode ?? '—',
        })}
      </p>
      {message && <p role="alert">{message}</p>}
      <Form as="div">
        <label>
          {t('authoring.sentences.text')}
          <input value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label>
          {t('authoring.sentences.translation')}
          <input value={translation} onChange={(e) => setTranslation(e.target.value)} />
        </label>
        <label>
          {t('authoring.sentences.status')}
          <select
            value={reviewStatus}
            onChange={(e) => setReviewStatus(e.target.value as ReviewStatus)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`authoring.sentences.reviewStatus.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('authoring.sentences.challenge')}
          <select value={challenge} onChange={(e) => setChallenge(e.target.value)}>
            <option value="">
              {sentence.challengeOverride === null
                ? t('authoring.sentences.challengeDerived', { value: yesNo(value.challenging) })
                : t('authoring.sentences.challengeFromLevels')}
            </option>
            <option value="true">{t('authoring.sentences.challengeYes')}</option>
            <option value="false">{t('authoring.sentences.challengeNo')}</option>
          </select>
        </label>
      </Form>
      <h4>{t('authoring.sentences.tiles')}</h4>
      <TileList>
        {tiles.map((tile, i) => (
          <li
            key={`${i}:${tile.surface}`}
            aria-label={t('authoring.sentences.tile', { n: i + 1, surface: tile.surface })}
          >
            <strong>{tile.surface}</strong>{' '}
            <input
              aria-label={t('authoring.sentences.base', { n: i + 1, surface: tile.surface })}
              value={tile.base}
              onChange={(e) => setTile(i, { base: e.target.value })}
            />{' '}
            <input
              aria-label={t('authoring.sentences.reading', { n: i + 1, surface: tile.surface })}
              value={tile.reading}
              onChange={(e) => setTile(i, { reading: e.target.value })}
            />{' '}
            <label>
              <input
                type="checkbox"
                checked={tile.pattern === true}
                onChange={(e) => setTile(i, { pattern: e.target.checked ? true : undefined })}
              />
              {t('authoring.sentences.pattern', { n: i + 1, surface: tile.surface })}
            </label>{' '}
            {[...tile.surface].length > 1 && (
              <select
                aria-label={t('authoring.sentences.splitAt', { n: i + 1, surface: tile.surface })}
                value=""
                onChange={(e) => setTiles((ts) => splitTile(ts, i, Number(e.target.value)))}
              >
                <option value="">{t('authoring.sentences.splitChoose')}</option>
                {[...tile.surface].slice(1).map((_, k) => {
                  const at = [...tile.surface].slice(0, k + 1).join('').length;
                  return (
                    <option key={at} value={at}>
                      {`${tile.surface.slice(0, at)}|${tile.surface.slice(at)}`}
                    </option>
                  );
                })}
              </select>
            )}{' '}
            {i < tiles.length - 1 && (
              <Button
                type="button"
                aria-label={t('authoring.sentences.merge', { n: i + 1, surface: tile.surface })}
                onClick={() => setTiles((ts) => mergeTiles(ts, i))}
              >
                {t('authoring.sentences.mergeShort')}
              </Button>
            )}
          </li>
        ))}
      </TileList>
      <Button type="submit">{t('authoring.save')}</Button>{' '}
      <Button
        type="button"
        onClick={() => window.confirm(t('authoring.sentences.confirmResegment')) && void save(true)}
      >
        {t('authoring.sentences.resegment')}
      </Button>
    </form>
  );
}

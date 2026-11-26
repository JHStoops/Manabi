import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { BlockedWord, SupplementaryWord } from '@manabi/core';
import { useApi } from '../../state/session';
import { Button, Form, Section, Table } from './ui';
import { apiErrorMessage } from '../auth/ui';

/** FR-234: the supplementary common words per level; add, edit, remove, filter by level. */
export function SupplementaryWordsPanel() {
  const { t } = useTranslation();
  const api = useApi();
  const [words, setWords] = useState<SupplementaryWord[]>([]);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [course, setCourse] = useState('');
  const [level, setLevel] = useState('');
  const [written, setWritten] = useState('');
  const [reading, setReading] = useState('');
  const [note, setNote] = useState('');

  const fail = useCallback((err: unknown) => setMessage(apiErrorMessage(t, err)), [t]);
  const load = useCallback(
    () =>
      api
        .GET('/api/v1/authoring/word-lists/supplementary-words')
        .then((b) => setWords(b.words), fail),
    [api, fail],
  );
  useEffect(() => void load(), [load]);

  const levels = [...new Set(words.map((w) => w.level))].sort();
  const shown = filter ? words.filter((w) => w.level === filter) : words;

  function reset() {
    setEditing(null);
    setWritten('');
    setReading('');
    setNote('');
  }

  function startEdit(word: SupplementaryWord) {
    setEditing(word.id);
    setCourse(word.course);
    setLevel(word.level);
    setWritten(word.written);
    setReading(word.reading);
    setNote(word.note ?? '');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      if (editing === null) {
        await api.POST('/api/v1/authoring/word-lists/supplementary-words', {
          body: { course, level, written, reading, ...(note ? { note } : {}) },
        });
      } else {
        await api.PATCH('/api/v1/authoring/word-lists/supplementary-words/{id}', {
          params: { path: { id: String(editing) } },
          body: { level, written, reading, note: note || null },
        });
      }
      reset();
      await load();
    } catch (err) {
      fail(err);
    }
  }

  async function remove(word: SupplementaryWord) {
    setMessage('');
    try {
      await api.DELETE('/api/v1/authoring/word-lists/supplementary-words/{id}', {
        params: { path: { id: String(word.id) } },
      });
      if (editing === word.id) reset();
      await load();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <Section aria-labelledby="admin-supplementary">
      <h2 id="admin-supplementary">{t('admin.wordLists.supplementaryTitle')}</h2>
      <p>{t('admin.wordLists.saveNote')}</p>
      <Form onSubmit={submit}>
        <label>
          {t('admin.wordLists.courseKey')}
          <input
            required
            disabled={editing !== null}
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          />
        </label>
        <label>
          {t('admin.wordLists.level')}
          <input required value={level} onChange={(e) => setLevel(e.target.value)} />
        </label>
        <label>
          {t('admin.wordLists.written')}
          <input required value={written} onChange={(e) => setWritten(e.target.value)} />
        </label>
        <label>
          {t('admin.wordLists.reading')}
          <input required value={reading} onChange={(e) => setReading(e.target.value)} />
        </label>
        <label>
          {t('admin.wordLists.note')}
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <Button type="submit">
          {editing === null ? t('admin.wordLists.add') : t('admin.wordLists.save')}
        </Button>
        {editing !== null && (
          <Button type="button" onClick={reset}>
            {t('admin.wordLists.cancel')}
          </Button>
        )}
      </Form>
      {message && <p role="status">{message}</p>}
      <label>
        {t('admin.wordLists.level')}{' '}
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">{t('admin.wordLists.allLevels')}</option>
          {levels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {shown.length === 0 ? (
        <p>{t('admin.wordLists.noSupplementary')}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t('admin.wordLists.courseKey')}</th>
              <th>{t('admin.wordLists.level')}</th>
              <th>{t('admin.wordLists.written')}</th>
              <th>{t('admin.wordLists.reading')}</th>
              <th>{t('admin.wordLists.note')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((w) => (
              <tr key={w.id}>
                <td>{w.course}</td>
                <td>{w.level}</td>
                <td>{w.written}</td>
                <td>{w.reading}</td>
                <td>{w.note ?? ''}</td>
                <td>
                  <Button
                    aria-label={t('admin.wordLists.editWord', { word: w.written })}
                    onClick={() => startEdit(w)}
                  >
                    {t('admin.wordLists.edit')}
                  </Button>{' '}
                  <Button
                    aria-label={t('admin.wordLists.removeWord', { word: w.written })}
                    onClick={() => void remove(w)}
                  >
                    {t('admin.wordLists.remove')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Section>
  );
}

/** FR-237: the blocklist per language; add and remove. */
export function BlockedWordsPanel() {
  const { t } = useTranslation();
  const api = useApi();
  const [words, setWords] = useState<BlockedWord[]>([]);
  const [message, setMessage] = useState('');
  const [lang, setLang] = useState('');
  const [word, setWord] = useState('');

  const fail = useCallback((err: unknown) => setMessage(apiErrorMessage(t, err)), [t]);
  const load = useCallback(
    () =>
      api.GET('/api/v1/authoring/word-lists/blocked-words').then((b) => setWords(b.words), fail),
    [api, fail],
  );
  useEffect(() => void load(), [load]);

  async function add(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await api.POST('/api/v1/authoring/word-lists/blocked-words', { body: { lang, word } });
      setWord('');
      await load();
    } catch (err) {
      fail(err);
    }
  }

  async function remove(w: BlockedWord) {
    setMessage('');
    try {
      await api.DELETE('/api/v1/authoring/word-lists/blocked-words/{id}', {
        params: { path: { id: String(w.id) } },
      });
      await load();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <Section aria-labelledby="admin-blocked">
      <h2 id="admin-blocked">{t('admin.wordLists.blockedTitle')}</h2>
      <Form onSubmit={add}>
        <label>
          {t('admin.wordLists.lang')}
          <input required value={lang} onChange={(e) => setLang(e.target.value)} />
        </label>
        <label>
          {t('admin.wordLists.word')}
          <input required value={word} onChange={(e) => setWord(e.target.value)} />
        </label>
        <Button type="submit">{t('admin.wordLists.block')}</Button>
      </Form>
      {message && <p role="status">{message}</p>}
      {words.length === 0 ? (
        <p>{t('admin.wordLists.noBlocked')}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t('admin.wordLists.lang')}</th>
              <th>{t('admin.wordLists.word')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {words.map((w) => (
              <tr key={w.id}>
                <td>{w.lang}</td>
                <td>{w.word}</td>
                <td>
                  <Button
                    aria-label={t('admin.wordLists.unblockWord', { word: w.word })}
                    onClick={() => void remove(w)}
                  >
                    {t('admin.wordLists.remove')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Section>
  );
}

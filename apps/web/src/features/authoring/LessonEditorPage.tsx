import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createLanguagePluginRegistry, exerciseTypeIds } from '@manabi/core';
import type { LessonEditor, SessionExercise } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';
import { Button, Form, Section } from '../admin/ui';
import { ExerciseForm } from './ExerciseForm';
import { ItemPicker } from './ItemPicker';

// FR-223, FR-224, FR-049, Product Spec section 11: the lesson editor. Choose the new items, then
// let the generators make exercises to pin, or hand-write them; edit or remove stored ones, and
// preview the lesson in the real player without recording progress.

const plugins = createLanguagePluginRegistry([japanese]);

/** What the form is open on: a new exercise of a type, or a stored one. */
type Editing = {
  type: string;
  origin: 'authored' | 'pinned';
  id?: number;
  payload?: Record<string, unknown>;
} | null;

/** A one-line summary of an exercise: its prompt, else its payload. */
function summary({ payload }: { payload: Record<string, unknown> }): string {
  return typeof payload.prompt === 'string' ? payload.prompt : JSON.stringify(payload);
}

export default function LessonEditorPage() {
  const { t } = useTranslation();
  const api = useApi();
  const { lessonId = '' } = useParams();
  const [editor, setEditor] = useState<LessonEditor | null>(null);
  const [generated, setGenerated] = useState<SessionExercise[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  // Keys the form per opening, so the first save of a new exercise keeps its warnings shown.
  const [opened, setOpened] = useState(0);
  const open = (next: Editing) => {
    setOpened((n) => n + 1);
    setEditing(next);
  };
  const [newType, setNewType] = useState(exerciseTypeIds()[0] ?? '');
  const [message, setMessage] = useState('');
  const params = { path: { id: lessonId } };

  const load = () =>
    api
      .GET('/api/v1/authoring/lessons/{id}/editor', { params })
      .then(setEditor, (err: unknown) => setMessage(apiErrorMessage(t, err)));
  useEffect(() => {
    void load();
  }, [api, lessonId]);

  async function send(request: Promise<LessonEditor>) {
    setMessage('');
    try {
      setEditor(await request);
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
    }
  }

  async function generate() {
    setMessage('');
    try {
      setGenerated(
        (await api.GET('/api/v1/authoring/lessons/{id}/generated', { params })).exercises,
      );
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
    }
  }

  if (!editor) return message ? <p role="alert">{message}</p> : <p>{t('app.loading')}</p>;
  const { lesson } = editor;

  return (
    <>
      <p>
        <Link to="/authoring">{t('lessonEditor.back')}</Link>
      </p>
      <h1>{lesson.title}</h1>
      <p>
        {t('lessonEditor.typeAndStatus', {
          type: t(`learn.lessonType.${lesson.type}`),
          status: t(`authoring.status.${lesson.status}`),
        })}{' '}
        <Link to={`/authoring/lessons/${lesson.id}/preview`}>{t('lessonEditor.preview')}</Link>
      </p>
      {message && <p role="alert">{message}</p>}

      <ItemPicker
        courseId={lesson.courseId}
        items={editor.items}
        plugin={plugins.has(lesson.plugin) ? plugins.get(lesson.plugin) : undefined}
        sectionLevel={lesson.sectionLevel}
        onChange={(itemIds) =>
          void send(api.PUT('/api/v1/authoring/lessons/{id}/items', { params, body: { itemIds } }))
        }
      />

      <Section aria-labelledby="lesson-exercises">
        <h2 id="lesson-exercises">{t('lessonEditor.exercises')}</h2>
        {editor.exercises.length === 0 && <p>{t('lessonEditor.noExercises')}</p>}
        <ol>
          {editor.exercises.map((e) => (
            <li key={e.id}>
              <strong>{e.type}</strong> {t(`lessonEditor.origin.${e.origin}`)} {summary(e)}{' '}
              <Button
                aria-label={t('lessonEditor.editEntry', { title: summary(e) })}
                onClick={() => open(e)}
              >
                {t('lessonEditor.edit')}
              </Button>
              <Button
                aria-label={t('authoring.delete', { title: summary(e) })}
                onClick={() =>
                  window.confirm(t('lessonEditor.confirmRemove')) &&
                  void send(
                    api.DELETE('/api/v1/authoring/exercises/{id}', {
                      params: { path: { id: String(e.id) } },
                    }),
                  )
                }
              >
                {t('lessonEditor.remove')}
              </Button>
            </li>
          ))}
        </ol>
        {editing ? (
          <ExerciseForm
            key={opened}
            lessonId={lesson.id}
            type={editing.type}
            origin={editing.origin}
            exerciseId={editing.id}
            payload={editing.payload}
            onSaved={(write) => {
              // Later saves edit what the first one created.
              setEditing(write.exercise);
              void load();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              open({ type: newType, origin: 'authored' });
            }}
          >
            <label>
              {t('authoring.type')}
              <select value={newType} onChange={(e) => setNewType(e.target.value)}>
                {exerciseTypeIds().map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <Button type="submit">{t('lessonEditor.write')}</Button>
          </Form>
        )}
      </Section>

      <Section aria-labelledby="lesson-generated">
        <h2 id="lesson-generated">{t('lessonEditor.generated')}</h2>
        <p>{t('lessonEditor.generatedHint')}</p>
        <Button onClick={() => void generate()}>{t('lessonEditor.generate')}</Button>
        {generated && generated.length === 0 && <p>{t('lessonEditor.noneGenerated')}</p>}
        {generated && (
          <ol>
            {generated.map((e, i) => (
              <li key={i}>
                <strong>{e.type}</strong> {summary(e)}{' '}
                <Button
                  aria-label={t('lessonEditor.pinEntry', { n: i + 1 })}
                  onClick={() => open({ type: e.type, origin: 'pinned', payload: e.payload })}
                >
                  {t('lessonEditor.pin')}
                </Button>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}

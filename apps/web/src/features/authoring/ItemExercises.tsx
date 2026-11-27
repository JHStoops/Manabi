import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditorExercise, ItemExercises as ItemExerciseList } from '@manabi/core';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';
import { Button, Section } from '../admin/ui';
import { ExerciseForm, exerciseSummary as summary } from './ExerciseForm';

// #241, FR-229, Product Spec section 11: an item's item-level exercises, such as the generated
// review exercises pinned by accepting an answer report. List, edit and remove them; reviews serve
// them alongside the generated ones.

/** An exercise's name for its buttons: type, id and summary, so two alike stay apart. */
const label = (e: EditorExercise) => `${e.type} ${e.id}: ${summary(e)}`;

export function ItemExercises({ itemId, itemKey }: { itemId: number; itemKey: string }) {
  const { t } = useTranslation();
  const api = useApi();
  const [exercises, setExercises] = useState<EditorExercise[] | null>(null);
  const [editing, setEditing] = useState<EditorExercise | null>(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const params = { path: { id: String(itemId) } };

  async function send(request: Promise<ItemExerciseList>): Promise<boolean> {
    setMessage('');
    try {
      setExercises((await request).exercises);
      return true;
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
      return false;
    }
  }

  async function remove(e: EditorExercise) {
    if (!window.confirm(t('lessonEditor.confirmRemove'))) return;
    if (editing?.id === e.id) setEditing(null);
    setStatus('');
    const removed = await send(
      api.DELETE('/api/v1/authoring/items/{id}/exercises/{exerciseId}', {
        params: { path: { id: String(itemId), exerciseId: String(e.id) } },
      }),
    );
    if (!removed) return;
    // The removed button had focus; keep it in the section and say what happened.
    heading.current?.focus();
    setStatus(t('authoring.items.removed', { title: label(e) }));
  }

  const load = () => send(api.GET('/api/v1/authoring/items/{id}/exercises', { params }));
  // Keyed by item in the item editor, so a new item gets a fresh list and no stale responses.
  useEffect(() => {
    void load();
  }, [api, itemId]);

  const headingId = `item-exercises-${itemId}`;
  return (
    <Section aria-labelledby={headingId}>
      <h4 id={headingId} ref={heading} tabIndex={-1}>
        {t('authoring.items.exercises', { key: itemKey })}
      </h4>
      <p>{t('authoring.items.exercisesHint')}</p>
      {message && <p role="alert">{message}</p>}
      <p role="status">{status}</p>
      {exercises && exercises.length === 0 && <p>{t('authoring.items.noExercises')}</p>}
      {exercises && exercises.length > 0 && (
        <ol>
          {exercises.map((e) => (
            <li key={e.id}>
              <strong>{e.type}</strong> {t(`lessonEditor.origin.${e.origin}`)} {summary(e)}{' '}
              <Button
                type="button"
                aria-label={t('lessonEditor.editEntry', { title: label(e) })}
                onClick={() => setEditing(e)}
              >
                {t('lessonEditor.edit')}
              </Button>
              <Button
                type="button"
                aria-label={t('lessonEditor.removeEntry', { label: label(e) })}
                onClick={() => void remove(e)}
              >
                {t('lessonEditor.remove')}
              </Button>
            </li>
          ))}
        </ol>
      )}
      {editing && (
        <ExerciseForm
          key={editing.id}
          type={editing.type}
          origin={editing.origin}
          exerciseId={editing.id}
          payload={editing.payload}
          onSaved={() => void load()}
          onCancel={() => setEditing(null)}
        />
      )}
    </Section>
  );
}

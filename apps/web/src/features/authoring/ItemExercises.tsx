import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditorExercise, ItemExercises as ItemExerciseList } from '@manabi/core';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';
import { Button, Section } from '../admin/ui';
import { ExerciseForm, exerciseSummary as summary } from './ExerciseForm';

// #241, FR-229, Product Spec section 11: an item's item-level exercises, such as the generated
// review exercises pinned by accepting an answer report. List, edit and remove them; reviews serve
// them alongside the generated ones.

export function ItemExercises({ itemId, itemKey }: { itemId: number; itemKey: string }) {
  const { t } = useTranslation();
  const api = useApi();
  const [exercises, setExercises] = useState<EditorExercise[] | null>(null);
  const [editing, setEditing] = useState<EditorExercise | null>(null);
  const [message, setMessage] = useState('');
  const params = { path: { id: String(itemId) } };

  async function send(request: Promise<ItemExerciseList>) {
    setMessage('');
    try {
      setExercises((await request).exercises);
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
    }
  }

  const load = () => send(api.GET('/api/v1/authoring/items/{id}/exercises', { params }));
  useEffect(() => {
    setEditing(null);
    void load();
  }, [api, itemId]);

  const headingId = `item-exercises-${itemId}`;
  return (
    <Section aria-labelledby={headingId}>
      <h3 id={headingId}>{t('authoring.items.exercises', { key: itemKey })}</h3>
      <p>{t('authoring.items.exercisesHint')}</p>
      {message && <p role="alert">{message}</p>}
      {exercises && exercises.length === 0 && <p>{t('authoring.items.noExercises')}</p>}
      {exercises && exercises.length > 0 && (
        <ol>
          {exercises.map((e) => (
            <li key={e.id}>
              <strong>{e.type}</strong> {t(`lessonEditor.origin.${e.origin}`)} {summary(e)}{' '}
              <Button
                type="button"
                aria-label={t('lessonEditor.editEntry', { title: summary(e) })}
                onClick={() => setEditing(e)}
              >
                {t('lessonEditor.edit')}
              </Button>
              <Button
                type="button"
                aria-label={t('authoring.delete', { title: summary(e) })}
                onClick={() => {
                  if (!window.confirm(t('lessonEditor.confirmRemove'))) return;
                  if (editing?.id === e.id) setEditing(null);
                  void send(
                    api.DELETE('/api/v1/authoring/items/{id}/exercises/{exerciseId}', {
                      params: { path: { id: String(itemId), exerciseId: String(e.id) } },
                    }),
                  );
                }}
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

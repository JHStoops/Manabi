import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditorExercise } from '@manabi/core';
import { Button } from '../admin/ui';

// #259, SDD section 6: a pin whose recorded original the generators no longer make. Lessons and
// reviews then serve it next to the changed generated exercise, so the author is told, and can
// re-tie it to what is generated now or remove it. Text, not color alone, carries the mark
// (NFR-31).

/** The detached mark and its re-tie button, for a pin marked detached; nothing otherwise. */
export function DetachedPin({
  exercise,
  label,
  onRetie,
}: {
  exercise: EditorExercise;
  /** The exercise's name, for the button's accessible name. */
  label: string;
  /** Re-ties the pin; the button is disabled until it settles, so one click sends one. */
  onRetie: (e: EditorExercise) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  if (!exercise.detached) return null;
  return (
    <>
      <strong>{t('lessonEditor.detached')}</strong> {t('lessonEditor.detachedHint')}{' '}
      <Button
        type="button"
        aria-label={t('lessonEditor.retieEntry', { label })}
        disabled={busy}
        aria-busy={busy}
        onClick={() => {
          setBusy(true);
          void onRetie(exercise).finally(() => setBusy(false));
        }}
      >
        {t('lessonEditor.retie')}
      </Button>{' '}
    </>
  );
}

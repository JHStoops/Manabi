import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import type { Exercise, LanguagePlugin } from '@manabi/core';
import { AppThemeProvider } from '../../theme';
import { getExerciseRenderer } from './registry';

/**
 * Test harness for exercise renderers: renders the registered renderer for `exercise.type` with
 * the app theme and a Suspense fallback, and passes its answers to `onAnswer`. Needs the i18n
 * module imported and window.matchMedia stubbed, as in the other component tests.
 */
export function ExerciseRendererHarness({
  exercise,
  plugin,
  onAnswer,
}: {
  exercise: Exercise;
  plugin: LanguagePlugin;
  onAnswer(answer: unknown): void;
}) {
  const { t } = useTranslation();
  const Renderer = getExerciseRenderer(exercise.type);
  return (
    <AppThemeProvider>
      <Suspense fallback={<p>{t('app.loading')}</p>}>
        <Renderer payload={exercise.payload} plugin={plugin} onAnswer={onAnswer} />
      </Suspense>
    </AppThemeProvider>
  );
}

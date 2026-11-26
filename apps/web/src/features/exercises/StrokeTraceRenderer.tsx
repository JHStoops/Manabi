import { useTranslation } from 'react-i18next';
import type { StrokeTraceAnswer, StrokeTracePayload } from '@manabi/core';
import { StrokeCanvas } from '../strokes/StrokeCanvas';
import type { ExerciseRendererProps } from './registry';
import { Prompt } from './ui';

// EX-11 stroke trace (FR-044, FR-073): the answer is reported once every stroke is traced.

export default function StrokeTraceRenderer({
  payload,
  onAnswer,
}: ExerciseRendererProps<StrokeTracePayload, StrokeTraceAnswer>) {
  const { t } = useTranslation();
  return (
    <div>
      <Prompt>{t('exercise.strokeTrace', { character: payload.character })}</Prompt>
      <StrokeCanvas
        itemKey={payload.itemKey}
        character={payload.character}
        mode="trace"
        onComplete={(mistakes) => onAnswer({ mistakes })}
      />
    </div>
  );
}

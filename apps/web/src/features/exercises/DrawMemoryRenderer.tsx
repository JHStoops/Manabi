import type { DrawMemoryAnswer, DrawMemoryPayload } from '@manabi/core';
import { StrokeCanvas } from '../strokes/StrokeCanvas';
import type { ExerciseRendererProps } from './registry';
import { Prompt } from './ui';

// EX-12 draw from memory (FR-044, FR-073): no guide; the answer is reported once every stroke is drawn.

export default function DrawMemoryRenderer({
  payload,
  onAnswer,
}: ExerciseRendererProps<DrawMemoryPayload, DrawMemoryAnswer>) {
  return (
    <div>
      <Prompt>{payload.prompt}</Prompt>
      <StrokeCanvas
        itemKey={payload.itemKey}
        character={payload.character}
        mode="memory"
        onComplete={(mistakes) => onAnswer({ mistakes })}
      />
    </div>
  );
}

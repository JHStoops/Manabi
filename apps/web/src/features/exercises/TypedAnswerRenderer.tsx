import { useId } from 'react';
import type { TypedAnswerPayload } from '@manabi/core';
import type { ExerciseRendererProps } from './registry';
import { Field, KanaField, Prompt } from './ui';

// EX-04 typed answer (FR-042): a target-language answer gets romaji-to-kana input (FR-142), a
// base-language (English) one a plain field. The player grades it through the plugin (FR-143).

export default function TypedAnswerRenderer({
  payload,
  plugin,
  onAnswer,
}: ExerciseRendererProps<TypedAnswerPayload, string>) {
  const promptId = useId();
  return (
    <div>
      <Prompt id={promptId}>{payload.prompt}</Prompt>
      {payload.answerLanguage === 'target' ? (
        <KanaField aria-labelledby={promptId} plugin={plugin} onChange={onAnswer} />
      ) : (
        <Field
          aria-labelledby={promptId}
          autoCapitalize="off"
          autoComplete="off"
          onChange={(event) => onAnswer(event.target.value)}
        />
      )}
    </div>
  );
}

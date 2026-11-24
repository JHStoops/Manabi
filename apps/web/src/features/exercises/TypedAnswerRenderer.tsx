import { useId } from 'react';
import { css } from '@emotion/react';
import type { Theme } from '@emotion/react';
import styled from '@emotion/styled';
import type { TypedAnswerPayload } from '@manabi/core';
import { tapTarget } from '../../theme';
import { KanaInput } from './KanaInput';
import type { ExerciseRendererProps } from './registry';
import { Prompt } from './ui';

// EX-04 typed answer (FR-042): a target-language answer gets romaji-to-kana input (FR-142), a
// base-language (English) one a plain field. The player grades it through the plugin (FR-143).

const field = ({ theme }: { theme: Theme }) => css`
  ${tapTarget(theme)};
  box-sizing: border-box;
  width: 100%;
  padding: ${theme.spacing(2)};
  border: 2px solid ${theme.colors.border};
  border-radius: ${theme.radii.small};
  background: ${theme.colors.surface};
  color: ${theme.colors.text};
  font-size: ${theme.fontSizes.body};
`;
const Field = styled.input(field);
const KanaField = styled(KanaInput)(field);

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

import { useId } from 'react';
import styled from '@emotion/styled';
import type { ConjugatePayload } from '@manabi/core';
import type { ExerciseRendererProps } from './registry';
import { KanaField, Prompt } from './ui';

// EX-10 conjugate (FR-043): the word and the form asked for; typed with romaji-to-kana input
// (FR-142). The player grades it through the plugin (FR-143).

const Word = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing(4)};
  font-size: ${({ theme }) => theme.fontSizes.title};
  color: ${({ theme }) => theme.colors.text};
`;

export default function ConjugateRenderer({
  payload,
  plugin,
  onAnswer,
}: ExerciseRendererProps<ConjugatePayload, string>) {
  const promptId = useId();
  const wordId = useId();
  return (
    <div>
      <Prompt id={promptId}>{payload.prompt}</Prompt>
      <Word id={wordId} lang={plugin.code}>
        {payload.word}
      </Word>
      <KanaField aria-labelledby={`${promptId} ${wordId}`} plugin={plugin} onChange={onAnswer} />
    </div>
  );
}

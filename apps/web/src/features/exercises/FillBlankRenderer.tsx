import { useId, useState } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import type { FillBlankPayload } from '@manabi/core';
import type { ExerciseRendererProps } from './registry';
import { ChoiceButton, KanaField, Prompt } from './ui';

// EX-05 fill the blank (FR-042): choose the missing word from the options, or type it with
// romaji-to-kana input (FR-142) when the payload has none. The player grades it (FR-143).

const Sentence = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  margin: 0 0 ${({ theme }) => theme.spacing(4)};
  font-size: ${({ theme }) => theme.fontSizes.title};
  color: ${({ theme }) => theme.colors.text};
`;

/** The blank, underlined so it shows without color (NFR-31). */
const Blank = styled.span`
  min-width: 3em;
  border-bottom: 2px solid ${({ theme }) => theme.colors.text};
  text-align: center;
`;

const BlankField = styled(KanaField)`
  width: 8em;
`;

const Options = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

export default function FillBlankRenderer({
  payload,
  plugin,
  onAnswer,
}: ExerciseRendererProps<FillBlankPayload, string>) {
  const { t } = useTranslation();
  const promptId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div>
      <Prompt id={promptId}>{payload.prompt}</Prompt>
      <Sentence lang={plugin.code}>
        {payload.before}
        {payload.options ? (
          <Blank>{selected ?? '?'}</Blank>
        ) : (
          <BlankField
            aria-label={t('exercise.fillBlank.blank')}
            plugin={plugin}
            onChange={onAnswer}
          />
        )}
        {payload.after}
      </Sentence>
      {payload.options && (
        <Options role="group" aria-labelledby={promptId}>
          {payload.options.map((option) => (
            <ChoiceButton
              key={option}
              type="button"
              lang={plugin.code}
              aria-pressed={selected === option}
              onClick={() => {
                setSelected(option);
                onAnswer(option);
              }}
            >
              {option}
            </ChoiceButton>
          ))}
        </Options>
      )}
    </div>
  );
}

import { useEffect, useId, useState } from 'react';
import styled from '@emotion/styled';
import type { ChoicePayload } from '@manabi/core';
import type { ExerciseRendererProps } from './registry';
import { ChoiceButton, Prompt } from './ui';

// EX-01 multiple choice (FR-042). SDD section 9: keys 1 to 4 choose an option.

const Options = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const Shortcut = styled.span`
  margin-right: ${({ theme }) => theme.spacing(2)};
  color: ${({ theme }) => theme.colors.textMuted};
`;

export default function ChoiceRenderer({
  payload,
  onAnswer,
}: ExerciseRendererProps<ChoicePayload, number>) {
  const promptId = useId();
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const choose = (event: KeyboardEvent) => {
      const { target } = event;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      // Typing into a field is never a shortcut.
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]'))
        return;
      const index = ['1', '2', '3', '4'].indexOf(event.key);
      if (index < 0 || index >= payload.options.length) return;
      setSelected(index);
      onAnswer(index);
    };
    window.addEventListener('keydown', choose);
    return () => window.removeEventListener('keydown', choose);
  }, [payload, onAnswer]);

  return (
    <div>
      <Prompt id={promptId}>{payload.prompt}</Prompt>
      <Options role="group" aria-labelledby={promptId}>
        {payload.options.map((option, index) => (
          <ChoiceButton
            key={index}
            type="button"
            aria-pressed={selected === index}
            aria-keyshortcuts={String(index + 1)}
            onClick={() => {
              setSelected(index);
              onAnswer(index);
            }}
          >
            <Shortcut aria-hidden="true">{index + 1}</Shortcut>
            {option.text}
          </ChoiceButton>
        ))}
      </Options>
    </div>
  );
}

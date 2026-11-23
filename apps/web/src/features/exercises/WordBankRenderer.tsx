import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import type { WordBankPayload } from '@manabi/core';
import type { ExerciseRendererProps } from './registry';
import { ChoiceButton, Prompt, shuffled } from './ui';

// EX-03 word bank (FR-042): tap bank tiles to add them to the answer, tap an answer tile to put
// it back, and move a focused answer tile with the arrow keys.

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  min-height: 52px;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const Answer = styled(Row)`
  padding-bottom: ${({ theme }) => theme.spacing(2)};
  border-bottom: 2px solid ${({ theme }) => theme.colors.border};
`;

const Hint = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.small};
  color: ${({ theme }) => theme.colors.textMuted};
`;

export default function WordBankRenderer({
  payload,
  onAnswer,
}: ExerciseRendererProps<WordBankPayload, number[]>) {
  const { t } = useTranslation();
  const hintId = useId();
  const bank = [...payload.answer.tiles, ...payload.distractors];
  const [bankOrder] = useState(() => shuffled(bank.map((_, index) => index)));
  const [built, setBuilt] = useState<number[]>([]);
  const root = useRef<HTMLDivElement>(null);
  // A tile button that leaves or moves loses focus; this selector says where focus goes next.
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    if (!focusNext.current) return;
    root.current?.querySelector<HTMLElement>(focusNext.current)?.focus();
    focusNext.current = null;
  }, [built]);

  const update = (next: number[], focus: string | null) => {
    focusNext.current = focus;
    setBuilt(next);
    onAnswer(next);
  };

  const move = (event: KeyboardEvent, position: number) => {
    const to = position + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0);
    if (to === position || to < 0 || to >= built.length) return;
    event.preventDefault();
    const next = [...built];
    [next[position], next[to]] = [next[to]!, next[position]!];
    update(next, `[data-built="${built[position]}"]`);
  };

  return (
    <div ref={root}>
      <Prompt>{payload.prompt}</Prompt>
      <Answer role="group" aria-label={t('exercise.wordBank.answer')} aria-describedby={hintId}>
        {built.map((index, position) => (
          <ChoiceButton
            key={index}
            type="button"
            data-built={index}
            onClick={() =>
              update(
                built.filter((i) => i !== index),
                `[data-bank="${index}"]`,
              )
            }
            onKeyDown={(event) => move(event, position)}
          >
            {bank[index]!.surface}
          </ChoiceButton>
        ))}
      </Answer>
      <Row role="group" aria-label={t('exercise.wordBank.bank')}>
        {bankOrder.map((index) => {
          const used = built.includes(index);
          return (
            <ChoiceButton
              key={index}
              type="button"
              data-bank={index}
              aria-disabled={used}
              onClick={() => !used && update([...built, index], null)}
            >
              {bank[index]!.surface}
            </ChoiceButton>
          );
        })}
      </Row>
      <Hint id={hintId}>{t('exercise.wordBank.hint')}</Hint>
    </div>
  );
}

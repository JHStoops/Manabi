import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { WORD_BANK_TYPE } from '@manabi/core';
import type { LanguagePlugin } from '@manabi/core';
import { tapTarget, useMediaQuery } from '../../theme';
import { getExerciseRenderer } from './registry';
import { answerFromTiles, toWordBankPayload } from './wordBankAlternative';

// FR-144, Product Spec section 8: below 768 px a typed exercise offers a word bank instead. The
// answer still goes to the player as the typed exercise's own answer, so grading is unchanged.

const Toggle = styled.button`
  ${({ theme }) => tapTarget(theme)};
  margin-top: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: none;
  background: none;
  box-shadow: none;
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.fontSizes.body};
  text-decoration: underline;
  cursor: pointer;
`;

export function WordBankAlternative({
  type,
  payload,
  plugin,
  preferred,
  onAnswer,
  children,
}: {
  type: string;
  payload: unknown;
  plugin: LanguagePlugin;
  /** The learner's "prefer word bank on phones" setting: where the toggle starts. */
  preferred: boolean;
  onAnswer(answer: unknown): void;
  /** The exercise's own renderer. */
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const small = !useMediaQuery('(min-width: 768px)');
  const bank = useMemo(() => toWordBankPayload(type, payload, plugin), [type, payload, plugin]);
  const [on, setOn] = useState(preferred);
  if (!small || !bank) return <>{children}</>;
  const WordBank = getExerciseRenderer(WORD_BANK_TYPE);
  return (
    <>
      {on ? (
        <WordBank
          payload={bank}
          plugin={plugin}
          onAnswer={(order) => onAnswer(answerFromTiles(bank, order as number[]))}
        />
      ) : (
        children
      )}
      <Toggle
        type="button"
        onClick={() => {
          setOn(!on);
          onAnswer(''); // the other form starts empty
        }}
      >
        {t(on ? 'exercise.wordBank.typeInstead' : 'exercise.wordBank.useInstead')}
      </Toggle>
    </>
  );
}

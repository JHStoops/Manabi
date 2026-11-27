import { useState } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import type { SessionExercise } from '@manabi/core';
import { useApi } from '../../state/session';
import { tapTarget } from '../../theme';
import { apiErrorMessage } from '../auth/ui';

const Report = styled.button`
  ${({ theme }) => tapTarget(theme)};
  align-self: flex-start;
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)} 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.fontSizes.small};
  text-decoration: underline;
  cursor: pointer;
  &[aria-disabled='true'] {
    cursor: default;
    opacity: 0.5;
  }
`;

const Note = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing(3)};
  font-size: ${({ theme }) => theme.fontSizes.small};
  &:empty {
    margin: 0;
  }
`;

/**
 * FR-054, Product Spec section 4: "my answer should be accepted" on a wrong answer's feedback
 * bar. It files a report for the author naming the session the exercise was served in; the
 * server reports its own copy of the exercise. One report per presentation. The thanks is
 * announced through a live region that is there from the start, and `onSent` moves focus on
 * (to Continue), since the focused button goes away.
 */
export function ReportAnswerButton(props: {
  session: { kind: 'lesson' | 'review'; id: number };
  exercise: SessionExercise;
  answer: string;
  onSent?: () => void;
}) {
  const { t } = useTranslation();
  const api = useApi();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function send() {
    if (state !== 'idle') return;
    setState('sending');
    setError('');
    try {
      await api.POST('/api/v1/answer-reports', {
        body: {
          session: props.session,
          exercise: { type: props.exercise.type, payload: props.exercise.payload },
          answer: props.answer,
        },
      });
      setState('sent');
      props.onSent?.();
    } catch (err) {
      setError(apiErrorMessage(t, err));
      setState('idle');
    }
  }

  return (
    <>
      {state !== 'sent' && (
        <Report type="button" aria-disabled={state === 'sending'} onClick={() => void send()}>
          {t('player.reportAnswer')}
        </Report>
      )}
      <Note aria-live="polite">{state === 'sent' ? t('player.reported') : ''}</Note>
      {error && <Note role="alert">{error}</Note>}
    </>
  );
}

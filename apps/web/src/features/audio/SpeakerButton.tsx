import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { tapTarget } from '../../theme';
import { useSpeech } from './speech';
import type { Utterance } from './speech';

const Button = styled.button`
  ${({ theme }) => tapTarget(theme)};
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.body};
  cursor: pointer;
`;

/** FR-135, IF-03: a native button; renders nothing when the device has no voice. */
export function SpeakerButton({ slow = false, ...utterance }: Utterance & { slow?: boolean }) {
  const { t } = useTranslation();
  const { canSpeak, speak } = useSpeech();
  if (!canSpeak) return null;
  return (
    <Button
      type="button"
      aria-label={t(slow ? 'audio.playSlow' : 'audio.play')}
      onClick={() => void speak({ ...utterance, rate: slow ? 0.75 : 1 })}
    >
      {slow ? '🐢' : '🔊'}
    </Button>
  );
}

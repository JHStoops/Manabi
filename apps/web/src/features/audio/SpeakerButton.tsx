import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { tapTarget } from '../../theme';
import { clipUrl, useSpeech } from './speech';
import type { ClipOwner, Utterance } from './speech';

const Button = styled.button`
  ${({ theme }) => tapTarget(theme)};
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.body};
  cursor: pointer;
`;

const Pair = styled.span`
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing(1)};
  vertical-align: middle;
`;

type SpeakerProps = Utterance & {
  slow?: boolean;
  what: 'word' | 'example' | 'answer';
  /** FR-130: the item or sentence whose server clip plays; the device voice when absent. */
  owner?: ClipOwner | null;
};

/**
 * FR-135, IF-03: a native button; renders nothing when there is no server clip and the device
 * has no voice.
 */
export function SpeakerButton({ slow = false, what, owner, ...utterance }: SpeakerProps) {
  const { t } = useTranslation();
  const { canSpeak, speak } = useSpeech();
  const clip = utterance.clip ?? (owner ? () => Promise.resolve(clipUrl(owner)) : undefined);
  // FR-135: hidden only when neither a server clip nor a device voice can speak it.
  if (!canSpeak && !clip) return null;
  return (
    <Button
      type="button"
      aria-label={t(slow ? 'audio.playSlow' : 'audio.play', { what: t(`audio.what.${what}`) })}
      onClick={() => void speak({ ...utterance, clip, rate: slow ? 0.75 : 1 })}
    >
      {slow ? '🐢' : '🔊'}
    </Button>
  );
}

/** FR-133, Product Spec section 8: the speaker button and the 0.75-speed one beside it. */
export function SpeakerButtons(props: Omit<SpeakerProps, 'slow'>) {
  const { canSpeak } = useSpeech();
  if (!canSpeak && !props.owner && !props.clip) return null;
  return (
    <Pair>
      <SpeakerButton {...props} />
      <SpeakerButton {...props} slow />
    </Pair>
  );
}

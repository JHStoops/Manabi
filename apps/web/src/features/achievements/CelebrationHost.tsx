import { useEffect, useRef } from 'react';
import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { isFullScreenCelebration } from '@manabi/core';
import { useCelebrationDispatch, useCelebrations } from '../../state/celebrations';
import { useApi } from '../../state/session';
import { Confetti, pressable, primaryLedge, tapTarget, useMotion, useSound } from '../../theme';

// FR-165, FR-167: the one-time achievement celebration. Streak milestones fill the screen
// (Product Spec section 9); other unlocks show a centered card. Confetti and the grow-in follow
// the motion settings, the fanfare follows the sound-effects setting.

const growIn = keyframes`
  from { transform: scale(0.8); opacity: 0; }
  to { transform: none; opacity: 1; }
`;

const Backdrop = styled.div<{ full: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(4)};
  background: ${({ full, theme }) =>
    full ? theme.colors.background : `color-mix(in srgb, ${theme.colors.text} 45%, transparent)`};
`;

const Panel = styled.div<{ full: boolean; motion: boolean }>`
  width: 100%;
  max-width: ${({ full }) => (full ? '480px' : '360px')};
  box-sizing: border-box;
  padding: ${({ theme }) => theme.spacing(6)};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  text-align: center;
  ${({ full }) => (full ? 'border: none;' : '')}
  animation: ${({ motion }) =>
    motion
      ? css`
          ${growIn} 0.3s ease-out
        `
      : 'none'};
  h2 {
    margin: ${({ theme }) => theme.spacing(2)} 0;
    font-size: ${({ full, theme }) => (full ? theme.fontSizes.display : theme.fontSizes.title)};
  }
`;

const Icon = styled.span<{ full: boolean }>`
  display: block;
  font-size: ${({ full }) => (full ? '4rem' : '2.5rem')};
  line-height: 1;
`;

const Dismiss = styled.button`
  ${({ theme }) => tapTarget(theme)};
  ${({ theme }) => pressable(primaryLedge(theme))};
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing(4)};
  padding: ${({ theme }) => theme.spacing(3)};
  border: none;
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primaryText};
  font-size: ${({ theme }) => theme.fontSizes.body};
  font-weight: bold;
  cursor: pointer;
`;

/** Shows the head of the celebration queue, records it as seen, and moves on when dismissed. */
export function CelebrationHost() {
  const { t } = useTranslation();
  const api = useApi();
  const { queue } = useCelebrations();
  const dispatch = useCelebrationDispatch();
  const motion = useMotion();
  const play = useSound();
  const dismissRef = useRef<HTMLButtonElement>(null);
  const shown = queue[0];
  const key = shown?.key;

  // Shown once: recorded as seen as soon as it is on screen, so a reload does not show it again.
  useEffect(() => {
    if (!key) return;
    play('achievement');
    dismissRef.current?.focus();
    // A failed save only means it may show again on the next load.
    api.POST('/api/v1/me/achievements/seen', { body: { keys: [key] } }).catch(() => undefined);
    // Once per celebration: play changes identity on every render.
  }, [api, key]);

  if (!shown) return null;
  const full = isFullScreenCelebration(shown);
  const dismiss = () => dispatch({ type: 'dismissed' });
  return (
    <Backdrop
      full={full}
      data-testid="celebration"
      data-layout={full ? 'full-screen' : 'card'}
      onKeyDown={(e) => {
        if (e.key === 'Escape') dismiss();
        // The dialog's only control keeps focus while it is open.
        if (e.key === 'Tab') e.preventDefault();
      }}
    >
      <Confetti />
      <Panel
        full={full}
        motion={motion}
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        aria-describedby="celebration-kind"
      >
        <Icon full={full} aria-hidden="true">
          {full ? '🔥' : '🏆'}
        </Icon>
        <p id="celebration-kind">
          {t(full ? 'achievements.streakMilestone' : 'achievements.unlocked')}
        </p>
        <h2 id="celebration-title">{shown.title}</h2>
        <Dismiss ref={dismissRef} type="button" onClick={dismiss}>
          {t('achievements.continue')}
        </Dismiss>
      </Panel>
    </Backdrop>
  );
}

import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { useSettings } from '../state/session';
import { useMediaQuery } from './useMediaQuery';

// FR-167: animations and sound effects follow the learner's settings; the device's
// reduced-motion preference is honored regardless.

/** False when the learner or the device asks for reduced motion. */
export function useMotion(): boolean {
  const deviceReduces = useMediaQuery('(prefers-reduced-motion: reduce)');
  return !useSettings().reducedMotion && !deviceReduces;
}

// Short tones (frequency in Hz, in order) instead of audio files: nothing to load or license.
const effects = { correct: [660, 880], wrong: [220], complete: [523, 659, 784, 1047] };

/** Returns play(effect); it does nothing when sound effects are off or the browser has no Web Audio. */
export function useSound(): (effect: keyof typeof effects) => void {
  const { soundEffects } = useSettings();
  return (effect) => {
    if (!soundEffects || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    effects[effect].forEach((hz, i) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = hz;
      osc.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.1);
    });
    setTimeout(() => void ctx.close(), 1000);
  };
}

const fall = keyframes`
  from { transform: translateY(-10vh) rotate(0); opacity: 1; }
  to { transform: translateY(100vh) rotate(540deg); opacity: 0; }
`;
const Piece = styled.span<{ n: number }>`
  position: fixed;
  top: 0;
  left: ${({ n }) => (n * 37) % 100}%;
  width: 10px;
  height: 14px;
  background: ${({ theme, n }) => theme.sectionColors[n % theme.sectionColors.length]};
  animation: ${fall} ${({ n }) => 2 + (n % 5) * 0.4}s ease-in ${({ n }) => (n % 7) * 0.1}s forwards;
  pointer-events: none;
`;

/** Decorative confetti; renders nothing when motion is reduced. */
export function Confetti() {
  if (!useMotion()) return null;
  return (
    <div aria-hidden="true" data-testid="confetti">
      {Array.from({ length: 30 }, (_, n) => (
        <Piece key={n} n={n} />
      ))}
    </div>
  );
}

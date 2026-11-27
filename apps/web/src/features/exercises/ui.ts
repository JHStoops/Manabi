import { css } from '@emotion/react';
import type { Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { tapTarget } from '../../theme';
import { KanaInput } from './KanaInput';

// Shared pieces of the exercise renderers. IF-03: every control is a native button (keyboard
// operable) with a tap target of at least 44 px.

export const Prompt = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing(4)};
  font-size: ${({ theme }) => theme.fontSizes.title};
  color: ${({ theme }) => theme.colors.text};
`;

export const ChoiceButton = styled.button`
  ${({ theme }) => tapTarget(theme)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: 2px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
  font-size: ${({ theme }) => theme.fontSizes.body};
  cursor: pointer;
  &[aria-pressed='true'] {
    border-color: ${({ theme }) => theme.colors.primary};
    font-weight: bold;
  }
  /* aria-disabled rather than disabled, so a used control keeps keyboard focus. */
  &[aria-disabled='true'] {
    cursor: default;
    opacity: 0.5;
  }
`;

const field = ({ theme }: { theme: Theme }) => css`
  ${tapTarget(theme)};
  width: 100%;
  padding: ${theme.spacing(2)};
  /* NFR-30: the field edge needs 3:1 against the page. */
  border: 2px solid ${theme.colors.textMuted};
  border-radius: ${theme.radii.small};
  background: ${theme.colors.surface};
  color: ${theme.colors.text};
  font-size: ${theme.fontSizes.body};
`;
/** A typed-answer text field. */
export const Field = styled.input(field);
/** A typed-answer field with romaji-to-kana input (FR-142). */
export const KanaField = styled(KanaInput)(field);

/** A copy of `items` in random order (Fisher-Yates). */
export function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

import { css } from '@emotion/react';
import type { Theme } from '@emotion/react';

// Shared style objects (SDD section 9). IF-03: tap targets of at least 44 px and a visible focus.
export const tapTarget = (theme: Theme) => css`
  min-width: 44px;
  min-height: 44px;
  &:focus-visible {
    outline: 3px solid ${theme.colors.primary};
    outline-offset: 2px;
  }
`;

/** Product Spec section 10: a chunky button with a pressed-down state; `ledge` colors its lower edge. */
export const pressable = (ledge: string) => css`
  box-shadow: 0 3px 0 ${ledge};
  &:active:not(:disabled):not([aria-disabled='true']) {
    transform: translateY(2px);
    box-shadow: 0 1px 0 ${ledge};
  }
`;

/** The ledge under a filled primary button: the primary color, darkened. */
export const primaryLedge = (theme: Theme) =>
  `color-mix(in srgb, ${theme.colors.primary} 65%, #000)`;

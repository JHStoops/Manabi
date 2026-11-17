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

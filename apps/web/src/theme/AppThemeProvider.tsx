import type { ReactNode } from 'react';
import { ThemeProvider } from '@emotion/react';
import { useSettings } from '../state/session';
import { themeFor } from './themes';
import { useMediaQuery } from './useMediaQuery';

/** FR-166: the learner's theme and light/dark setting; signed out, the default theme follows the device. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const { theme, colorMode } = useSettings();
  return <ThemeProvider theme={themeFor(theme, colorMode, systemDark)}>{children}</ThemeProvider>;
}

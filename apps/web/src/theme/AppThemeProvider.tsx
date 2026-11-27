import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@emotion/react';
import { useSettings } from '../state/session';
import { GlobalStyles } from './GlobalStyles';
import { themeFor } from './themes';
import { useMediaQuery } from './useMediaQuery';

/** FR-166: the learner's theme and light/dark setting; signed out, the default theme follows the device. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const { theme, colorMode } = useSettings();
  const current = themeFor(theme, colorMode, systemDark);
  // The browser's address bar and the installed app's title bar follow the theme too (IF-02).
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', current.colors.background);
  }, [current]);
  return (
    <ThemeProvider theme={current}>
      <GlobalStyles />
      {children}
    </ThemeProvider>
  );
}

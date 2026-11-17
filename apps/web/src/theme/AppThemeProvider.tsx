import type { ReactNode } from 'react';
import { ThemeProvider } from '@emotion/react';
import { sakuraDark, sakuraLight } from './sakura';
import { useMediaQuery } from './useMediaQuery';

/** Wires the Emotion ThemeProvider to the system light/dark preference. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const dark = useMediaQuery('(prefers-color-scheme: dark)');
  return <ThemeProvider theme={dark ? sakuraDark : sakuraLight}>{children}</ThemeProvider>;
}

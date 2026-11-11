import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@emotion/react';
import { sakuraDark, sakuraLight } from './sakura';

const query = '(prefers-color-scheme: dark)';

/** Wires the Emotion ThemeProvider to the system light/dark preference. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return <ThemeProvider theme={dark ? sakuraDark : sakuraLight}>{children}</ThemeProvider>;
}

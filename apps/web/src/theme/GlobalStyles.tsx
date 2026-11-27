import { Global, css } from '@emotion/react';
import type { Theme } from '@emotion/react';

// SDD section 9: the page-wide base every screen builds on. Element rules sit inside :where() so
// any styled component overrides them without a specificity fight.

// Product Spec section 10 asks for large, friendly, rounded type. Rounded system faces first
// (SF Pro Rounded, Hiragino Maru Gothic), then each platform's Japanese UI font; nothing to download.
export const fontStack = [
  'ui-rounded',
  '"Hiragino Maru Gothic ProN"',
  '"M PLUS Rounded 1c"',
  'system-ui',
  '"Hiragino Sans"',
  '"Noto Sans JP"',
  '"Yu Gothic UI"',
  'Meiryo',
  'sans-serif',
].join(', ');

const styles = (theme: Theme) => css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html {
    color-scheme: ${theme.mode};
    -webkit-text-size-adjust: 100%;
  }

  body {
    margin: 0;
    min-height: 100dvh;
    background: ${theme.colors.background};
    color: ${theme.colors.text};
    font-family: ${fontStack};
    font-size: ${theme.fontSizes.body};
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  :where(h1, h2, h3, h4) {
    margin: 0 0 ${theme.spacing(3)};
    line-height: 1.25;
    text-wrap: balance;
  }
  :where(h1) {
    font-size: clamp(1.5rem, 1.2rem + 1.5vw, ${theme.fontSizes.display});
    font-weight: 800;
  }
  :where(h2) {
    margin-top: ${theme.spacing(6)};
    font-size: 1.25rem;
    font-weight: 700;
  }
  :where(h3) {
    font-size: 1.0625rem;
    font-weight: 700;
  }
  :where(p, ul, ol, dl, table) {
    margin: 0 0 ${theme.spacing(3)};
  }

  :where(a) {
    color: ${theme.colors.primary};
    text-underline-offset: 0.15em;
  }

  :where(img, svg, canvas, video) {
    max-width: 100%;
  }

  :where(button, input, select, textarea) {
    font: inherit;
    color: inherit;
  }

  /* Native controls nobody styled still look like the theme (IF-03: 44 px tap targets). */
  :where(button) {
    box-shadow: 0 3px 0 ${theme.colors.border};
    min-height: 44px;
    padding: 0 ${theme.spacing(4)};
    border: 2px solid ${theme.colors.border};
    border-radius: ${theme.radii.small};
    background: ${theme.colors.surface};
    color: ${theme.colors.text};
    font-weight: 600;
    cursor: pointer;
  }
  :where(button:active:not(:disabled, [aria-disabled='true'])) {
    transform: translateY(2px);
    box-shadow: 0 1px 0 ${theme.colors.border};
  }
  :where(button:disabled, button[aria-disabled='true']) {
    cursor: default;
    opacity: 0.6;
  }

  /* NFR-30, WCAG 1.4.11: field edges use the muted text color for at least 3:1. */
  :where(
    input:not([type='checkbox'], [type='radio'], [type='color'], [type='range'], [type='file']),
    select,
    textarea
  ) {
    min-height: 44px;
    max-width: 100%;
    padding: ${theme.spacing(2)} ${theme.spacing(3)};
    border: 1px solid ${theme.colors.textMuted};
    border-radius: ${theme.radii.small};
    background: ${theme.colors.surface};
    color: ${theme.colors.text};
  }
  :where(input[type='color']) {
    min-width: 44px;
    min-height: 44px;
    padding: 2px;
    border: 1px solid ${theme.colors.textMuted};
    border-radius: ${theme.radii.small};
    background: ${theme.colors.surface};
  }
  :where(input[type='checkbox'], input[type='radio'], progress) {
    accent-color: ${theme.colors.primary};
  }
  :where(input[type='checkbox'], input[type='radio']) {
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
  }

  :where(fieldset) {
    min-width: 0;
  }
  :where(th) {
    text-align: left;
  }

  /* IF-03: one visible focus ring for everything a keyboard reaches. */
  :focus-visible {
    outline: 3px solid ${theme.colors.primary};
    outline-offset: 2px;
  }

  /* FR-167: the device's reduced-motion setting always wins. */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

export function GlobalStyles() {
  return <Global styles={styles} />;
}

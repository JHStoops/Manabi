import { en } from './en';

export type MessageKey = keyof typeof en;

// shortcut: one English catalog read directly, no language switching; put the active catalog in a
// context (or adopt an i18n library) when a second interface language is added (FR-243).
export function t(key: MessageKey): string {
  return en[key];
}

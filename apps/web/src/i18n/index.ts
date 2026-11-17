import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';

// NFR-60: the catalog is bundled and loaded synchronously: no HTTP backend, no language detector.
void i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: en } },
  initAsync: false,
  interpolation: { escapeValue: false }, // React already escapes
});

// A misspelled key in t() fails typecheck.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}

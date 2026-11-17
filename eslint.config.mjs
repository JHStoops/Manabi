import { builtinModules } from 'node:module';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Language plugins are pure TypeScript that runs on both server and client (SDD section 4), so
// they may not touch Node built-ins or browser globals.
const nodeModules = builtinModules.filter((name) => !name.startsWith('_'));
const hostGlobals = [
  // Browser
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'self',
  'speechSynthesis',
  'alert',
  // Node
  'process',
  'Buffer',
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
  'global',
  'setImmediate',
].map((name) => ({ name, message: 'Language plugins are pure TypeScript: no host APIs.' }));

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/jest.config*.js',
      // Throwaway spike code (own package.json, not workspaces) stays out of all checks.
      'spikes/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // FR-238, FR-240: the analyzer is Node only and lives in packages/importers as a generic adapter;
  // the Japanese rules over its tokens live in packages/lang-ja.
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['packages/importers/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'kuromoji', message: 'kuromoji is imported only in packages/importers.' },
          ],
          patterns: [
            { group: ['kuromoji/*'], message: 'kuromoji is imported only in packages/importers.' },
          ],
        },
      ],
    },
  },
  {
    // Japanese text in importer code means a language rule; it belongs in packages/lang-ja.
    files: ['packages/importers/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...[
          'Literal[value=/[\\u3040-\\u30ff\\u4e00-\\u9fff]/]',
          'TemplateElement[value.raw=/[\\u3040-\\u30ff\\u4e00-\\u9fff]/]',
        ].map((selector) => ({
          selector,
          message: 'No Japanese rules in packages/importers: put them in packages/lang-ja.',
        })),
      ],
    },
  },
  {
    // FR-243: visible text in the web app comes from the translation catalog (src/i18n).
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...[
          'JSXText[value=/\\S/]',
          'JSXAttribute[name.name=/^(aria-label|title|alt|placeholder)$/] > Literal',
        ].map((selector) => ({
          selector,
          message:
            'Hard-coded UI text: add it to the catalog in src/i18n/en.ts and use t() from useTranslation.',
        })),
      ],
    },
  },
  {
    files: ['packages/lang-*/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeModules.map((name) => ({
            name,
            message: 'Language plugins are pure TypeScript: no Node built-ins.',
          })),
          patterns: [
            {
              group: ['node:*'],
              message: 'Language plugins are pure TypeScript: no Node built-ins.',
            },
            {
              // Allowlist: @manabi/core and the package's own files (./x, ../x; not ../../).
              regex: '^(?!@manabi/core$|\\./|\\.\\./(?!\\.\\./)).*',
              message: 'Language plugins import only @manabi/core and their own files.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...hostGlobals],
    },
  },
);

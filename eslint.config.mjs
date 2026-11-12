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
              group: ['@manabi/*', '!@manabi/core'],
              message: 'Language plugins depend only on @manabi/core.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...hostGlobals],
    },
  },
);

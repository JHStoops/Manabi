import { defineConfig } from '@playwright/test';

// PLACEHOLDER: end-to-end tests are not written yet.
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
});

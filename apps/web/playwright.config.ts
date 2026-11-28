import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Test-only admin password, generated per run. Workers inherit it from this (main) process.
process.env.E2E_ADMIN_PASSWORD ??= randomBytes(12).toString('hex');

const port = 4173;

// Runs against the production build served by the real API (as in Compose), on a scratch
// database that is wiped and seeded with the kana fixture pack at every start.
// E2E_DATABASE_URL must name a throwaway database, e.g. postgres://manabi:manabi@localhost:5432/manabi_e2e.
export default defineConfig({
  testDir: './e2e',
  // NFR-32 allows 5 minutes; the scripted flow itself is asserted well under that.
  timeout: 90_000,
  // Deterministic by design: no retries to paper over flakiness (#64).
  retries: 0,
  use: { baseURL: `http://localhost:${port}`, screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: [
      'npm run build',
      'node apps/web/e2e/resetDb.mjs',
      'npm run migrate --workspace @manabi/api',
      `echo "$E2E_ADMIN_PASSWORD" | npm run manabi --workspace @manabi/api -- create-admin e2eadmin`,
      `npm run manabi --workspace @manabi/api -- pack import apps/web/e2e/fixtures/ja-en`,
      // FR-077: stroke data for the fixture kanji (#64); also adds the course's kana items.
      `npm run manabi --workspace @manabi/api -- import kanjivg ja-en apps/web/e2e/fixtures/kanjivg.xml`,
      `npm start --workspace @manabi/api`,
    ].join(' && '),
    // The API and CLI take their settings from the environment; the root is where npm runs them.
    cwd: '../..',
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? '',
      PORT: String(port),
      PUBLIC_URL: `http://localhost:${port}`,
      WEB_DIST_DIR: join(__dirname, 'dist'),
      LOG_LEVEL: 'warn',
    },
    url: `http://localhost:${port}/api/v1/healthz`,
    // Never reuse: a running server was seeded with a different admin password.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

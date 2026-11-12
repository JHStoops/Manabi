const base = require('../../jest.config.base');

// NFR-51: at least 85% line coverage, enforced whenever coverage is collected
// (`npm run test:coverage`, which CI runs).
module.exports = {
  ...base,
  displayName: '@manabi/lang-ja',
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/**/*.d.ts'],
  coverageThreshold: { global: { lines: 85 } },
};

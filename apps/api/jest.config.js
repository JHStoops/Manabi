const base = require('../../jest.config.base');

// cookie@2 (pulled in by fastify -> light-my-request, used by app.inject, and by
// @fastify/cookie) ships ESM only. Node can require() it, but Jest's CommonJS
// loader cannot, so transpile it to CommonJS with ts-jest. @fastify/cookie loads
// it with a dynamic import(), which Jest also refuses without
// --experimental-vm-modules; transpiling turns that import() into require().
const esmOnlyPackages = ['cookie', '@fastify/cookie'];

module.exports = {
  ...base,
  displayName: '@manabi/api',
  transform: {
    ...base.transform,
    [`node_modules/(${esmOnlyPackages.join('|')})/.+\\.js$`]: [
      'ts-jest',
      { tsconfig: { allowJs: true, module: 'commonjs', isolatedModules: true } },
    ],
  },
  transformIgnorePatterns: [`/node_modules/(?!(${esmOnlyPackages.join('|')})/)`],
  // Integration tests: a fresh, migrated database per run and per worker (src/test/).
  globalSetup: '<rootDir>/src/test/globalSetup.ts',
  globalTeardown: '<rootDir>/src/test/globalTeardown.ts',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/test/**',
    '!src/{server,worker,migrate}.ts',
  ],
};

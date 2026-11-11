const base = require('../../jest.config.base');

// cookie@2 (pulled in by fastify -> light-my-request, used by app.inject) ships
// ESM only. Node can require() it, but Jest's CommonJS loader cannot, so
// transpile that one package to CommonJS with ts-jest.
const esmOnlyPackages = ['cookie'];

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
};

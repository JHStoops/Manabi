const base = require('../../jest.config.base');

module.exports = {
  ...base,
  displayName: '@manabi/web',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
};

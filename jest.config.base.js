/**
 * Shared Jest configuration (ts-jest). Each workspace spreads this into its own jest.config.js.
 * Type checking is done by `npm run typecheck`; ts-jest only transpiles (isolatedModules).
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2022',
          module: 'commonjs',
          moduleResolution: 'node',
          jsx: 'react-jsx',
          strict: true,
          esModuleInterop: true,
          isolatedModules: true,
          skipLibCheck: true,
        },
      },
    ],
  },
};

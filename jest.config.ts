import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/js-with-babel',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts', '**/*.test.tsx', '**/*.test.js', '**/*.test.jsx'],
  clearMocks: true,
  // Exclude Playwright tests from Jest - run with `npx playwright test` instead
  testPathIgnorePatterns: ['<rootDir>/tests/playwright/'],
  // Transform ESM packages that ship modern syntax (allowlist)
  transformIgnorePatterns: ['/node_modules/(?!(uuid|chai)/)'],
};

export default config;

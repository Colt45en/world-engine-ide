const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  webServer: {
    command: 'npx serve public -l 8082',
    port: 8082,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
  testDir: './tests/playwright',
  use: { headless: true, baseURL: 'http://localhost:8082' },
});

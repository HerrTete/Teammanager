const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/ui',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3456',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: undefined,
});

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8000',
    browserName: 'chromium',
    // Local runs use real Chrome for visual parity with the recorded product;
    // CI uses Playwright's pinned Chromium so a runner image update cannot
    // silently change the browser underneath the test suite.
    channel: process.env.CI ? undefined : 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:8000/',
    reuseExistingServer: true,
    timeout: 15_000
  }
});

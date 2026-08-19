const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  // A GitHub runner has two shared cores; starting two MapLibre/WebGL pages at
  // once starves Chromium badly enough that navigation itself can hit 30s.
  // Serialize only in CI and widen the ceiling there. Assertions and local
  // real-Chrome timings remain unchanged, so this is not a retry-based mask.
  workers: process.env.CI ? 1 : undefined,
  timeout: process.env.CI ? 90_000 : 30_000,
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

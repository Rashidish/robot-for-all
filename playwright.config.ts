// Browser tests (M1 spec §9): a small, cheap Android-sized phone in Chromium.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    ...devices['Galaxy S9+'],
    viewport: { width: 360, height: 640 },
    serviceWorkers: 'allow',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'mobile-chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node tests/serve.mjs 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env['CI']
  }
});

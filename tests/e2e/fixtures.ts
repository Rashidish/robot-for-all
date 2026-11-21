// Shared test setup: every test fails if the page logs an error (including CSP violations)
// or tries to load anything from another site.
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page, baseURL }, use) => {
      const problems: string[] = [];
      const origin = new URL(baseURL ?? 'http://localhost:4321').origin;
      // Expected noise: the 404 test's own status, and failed requests while deliberately offline.
      const expected = /status of 404|ERR_INTERNET_DISCONNECTED/;
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !expected.test(msg.text())) {
          problems.push(`console: ${msg.text()}`);
        }
      });
      page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
      page.on('request', (req) => {
        const url = new URL(req.url());
        if (/^https?:$/.test(url.protocol) && url.origin !== origin) {
          problems.push(`third-party request: ${req.url()}`);
        }
      });
      await use(problems);
      expect(problems, 'errors or third-party requests').toEqual([]);
    },
    { auto: true }
  ]
});

export { expect };

export const LESSON = '/lessons/p1-crank-01/';

/** Waits until the service worker is installed and controlling the page. */
export async function waitForServiceWorker(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}

// M3 step 1 spike: the block editor under our strict CSP, .hex download, WebUSB permission,
// and offline use after the first visit. Grows into the full editor journeys in steps 3–5.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test, expect, waitForServiceWorker } from './fixtures';

const CODE = '/code/';

test.describe('code editor (M3)', () => {
  test('Blockly loads with its toolbox on a 360 px phone', async ({ page }) => {
    await page.goto(CODE);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Code editor');
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    await expect
      .poll(() => page.locator('.blocklyFlyout .blocklyDraggable').count())
      .toBeGreaterThan(0);
  });

  // Blockly's CSS differs slightly between phones/Apple devices and other computers, so check
  // both: a desktop hash was missing at first and the editor rendered black on Windows.
  const browsers = [
    { name: 'phone', options: {} },
    {
      name: 'Windows desktop',
      options: {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        isMobile: false,
        hasTouch: false
      }
    }
  ];

  for (const { name, options } of browsers) {
    test(`Blockly's generated styles are allowed by exact hash (${name})`, async ({ browser }) => {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      const response = await page.goto(CODE);
      const policy = (await response?.headerValue('content-security-policy')) ?? '';
      await expect(page.locator('.blocklySvg').first()).toBeVisible();
      const styles = await page.evaluate(() =>
        [...document.querySelectorAll('style')].map((s) => s.textContent ?? '')
      );
      const hashes = styles.map(
        (css) => `'sha256-${createHash('sha256').update(css).digest('base64')}'`
      );
      expect(hashes.length, 'Blockly should add its stylesheets').toBeGreaterThan(0);
      const missing = hashes.filter((h) => !policy.includes(h));
      // If Blockly changes its CSS (e.g. after an upgrade), copy these into /code/* in _headers.
      expect(missing, `add to style-src for /code/*: ${missing.join(' ')}`).toEqual([]);
      await context.close();
    });

    test(`the blocks never cover the buttons (${name})`, async ({ browser }) => {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      await page.goto(CODE);
      await expect(page.locator('.blocklyFlyout').first()).toBeVisible();
      for (const label of ['Download .hex', 'Send to micro:bit']) {
        const button = page.getByRole('button', { name: label });
        await expect(button).toBeInViewport();
        // The button itself must be what a tap at its centre hits.
        const onTop = await button.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
        });
        expect(onTop, `${label} is covered`).toBe(true);
      }
      await context.close();
    });
  }

  test('WebUSB is allowed on this page only', async ({ page }) => {
    const response = await page.goto(CODE);
    expect(await response?.headerValue('permissions-policy')).toContain('usb=(self)');
    await expect(page.getByRole('button', { name: 'Send to micro:bit' })).toBeVisible();
    const home = await page.goto('/');
    expect(await home?.headerValue('permissions-policy')).toContain('usb=()');
  });

  test('Download .hex gives a universal hex with the program inside', async ({ page }) => {
    await page.goto(CODE);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download .hex' }).click()
    ]);
    expect(download.suggestedFilename()).toBe('robot-for-all.hex');
    const hex = readFileSync((await download.path()) ?? '', 'utf8');
    expect(hex).toMatch(/^:0400000A/m);
    expect(hex.length).toBeGreaterThan(1_000_000);
    await expect(page.locator('p.status')).toHaveText('Done.');
  });

  test('works offline after the first visit, including Download .hex', async ({
    page,
    context
  }) => {
    await page.goto(CODE);
    await waitForServiceWorker(page);
    await page.reload();
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    // First download stores the firmware.
    await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download .hex' }).click()
    ]);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download .hex' }).click()
    ]);
    await expect(page.locator('p.status')).toHaveText('Done.');
  });
});

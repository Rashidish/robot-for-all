// M3 code editor journeys (spec §3, §9): blocks under our strict CSP on phones and computers,
// Python view, saving, program files, .hex download, WebUSB permission and offline use.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { devices, type Page } from '@playwright/test';
import { test, expect, waitForServiceWorker } from './fixtures';

const CODE = '/code/';

const heartFile = JSON.stringify({
  format: 'robot-for-all-program',
  version: 1,
  name: 'Heart test',
  program: {
    version: 1,
    handlers: [
      {
        type: 'forever',
        body: [
          { type: 'show_icon', icon: 'HEART' },
          { type: 'pause', ms: { type: 'number', value: 500 } }
        ]
      }
    ]
  }
});

async function openEditor(page: Page) {
  await page.goto(CODE);
  await expect(page.locator('.blocklySvg').first()).toBeVisible();
}

async function importHeart(page: Page) {
  await page.getByRole('button', { name: 'My programs' }).click();
  await page.getByLabel('Open a file').setInputFiles({
    name: 'heart.rfa.json',
    mimeType: 'application/json',
    buffer: Buffer.from(heartFile)
  });
}

test.describe('code editor (M3)', () => {
  test('opens with MakeCode-style categories and an "on start" and "forever" block', async ({
    page
  }) => {
    await openEditor(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Code editor');
    for (const category of [
      'Basic',
      'Input',
      'Music',
      'LED',
      'Radio',
      'Loops',
      'Logic',
      'Variables',
      'Math',
      'Motors',
      'Extensions',
      'Advanced'
    ]) {
      await expect(
        page.locator('.blocklyToolboxCategoryLabel', { hasText: category })
      ).toBeVisible();
    }
    await expect(
      page.locator('.blocklyWorkspace .blocklyText', { hasText: 'on start' }).first()
    ).toBeVisible();
    await expect(
      page.locator('.blocklyWorkspace .blocklyText', { hasText: 'forever' }).first()
    ).toBeVisible();
    await page.locator('.blocklyToolboxCategory', { hasText: 'Basic' }).click();
    await expect(
      page.locator('.blocklyFlyout .blocklyText', { hasText: 'show icon' })
    ).toBeVisible();
  });

  test('a program file opens, shows its Python, and is still there after a reload', async ({
    page
  }) => {
    await openEditor(page);
    await importHeart(page);
    await expect(page.getByLabel('Program name')).toHaveValue('Heart test');
    await page.getByRole('tab', { name: 'Python' }).click();
    await expect(page.locator('#panel-python code')).toContainText('display.show(Image.HEART)');
    await expect(page.locator('#panel-python code')).toContainText('sleep(500)');
    await page.reload();
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    await expect(page.getByLabel('Program name')).toHaveValue('Heart test');
    await page.getByRole('tab', { name: 'Python' }).click();
    await expect(page.locator('#panel-python code')).toContainText('display.show(Image.HEART)');
  });

  test('a file that is not a program is refused', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'My programs' }).click();
    await page.getByLabel('Open a file').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"x":1}')
    });
    await expect(page.locator('p.status')).toHaveText("That file isn't a Robot For All program.");
  });

  test('My programs lists, saves to file and starts new programs', async ({ page }) => {
    await openEditor(page);
    await importHeart(page);
    await page.getByRole('button', { name: 'My programs' }).click();
    const dialog = page.getByRole('dialog', { name: 'My programs' });
    await expect(dialog.getByText('Heart test')).toBeVisible();
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Save to file' }).click()
    ]);
    expect(file.suggestedFilename()).toBe('Heart-test.rfa.json');
    const saved = JSON.parse(readFileSync((await file.path()) ?? '', 'utf8')) as { format: string };
    expect(saved.format).toBe('robot-for-all-program');
    await dialog.getByRole('button', { name: 'New' }).click();
    await expect(page.getByLabel('Program name')).toHaveValue('My program');
    await page.getByRole('button', { name: 'My programs' }).click();
    // The first empty program, the opened file, and the new one.
    await expect(dialog.getByRole('listitem')).toHaveCount(3);
  });

  // Blockly's CSS differs slightly between phones/Apple devices and other computers, so check
  // both: a desktop hash was missing at first and the editor rendered black on Windows.
  const browsers = [
    { name: 'phone', options: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 640 } } },
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
      await page.locator('.blocklyToolboxCategory', { hasText: 'Basic' }).click();
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
      await expect(page.locator('.blocklySvg').first()).toBeVisible();
      await page.locator('.blocklyToolboxCategory', { hasText: 'Basic' }).click();
      for (const label of ['Download .hex', 'Send to micro:bit', 'My programs']) {
        const button = page.getByRole('button', { name: label });
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeInViewport({ ratio: 0.9 });
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

  test('Download .hex gives a universal hex named after the program', async ({ page }) => {
    await openEditor(page);
    await importHeart(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download .hex' }).click()
    ]);
    expect(download.suggestedFilename()).toBe('Heart-test.hex');
    await expect(page.locator('p.status')).toContainText('Downloaded');
    const hex = readFileSync((await download.path()) ?? '', 'utf8');
    expect(hex).toMatch(/^:0400000A/m);
    expect(hex.length).toBeGreaterThan(1_000_000);
  });

  test('works offline after the first visit, including Download .hex', async ({
    page,
    context
  }) => {
    await page.goto(CODE);
    await waitForServiceWorker(page);
    await page.reload();
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    // The first download stores the firmware.
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
    await expect(page.locator('p.status')).toContainText('Downloaded');
  });
});

test.describe('MakeCode-style toolbox (M3 step 4b)', () => {
  test('search finds blocks in any category', async ({ page }) => {
    await openEditor(page);
    await page.getByPlaceholder('Search blocks…').fill('tone');
    await expect(
      page.locator('.blocklyFlyout .blocklyText', { hasText: 'play tone' })
    ).toBeVisible();
    await page.getByPlaceholder('Search blocks…').fill('radio send');
    await expect(
      page.locator('.blocklyFlyout .blocklyText', { hasText: 'radio send number' })
    ).toBeVisible();
  });

  test('Advanced opens Functions, Text, Pins, Serial and Control', async ({ page }) => {
    await openEditor(page);
    await page.locator('.blocklyToolboxCategory', { hasText: 'Advanced' }).first().click();
    for (const category of ['Functions', 'Text', 'Pins', 'Serial', 'Control']) {
      await expect(
        page.locator('.blocklyToolboxCategoryLabel', { hasText: category })
      ).toBeVisible();
    }
  });

  test('the RGB LEDs extension adds its blocks', async ({ page }) => {
    await openEditor(page);
    await expect(page.locator('.blocklyToolboxCategoryLabel', { hasText: 'RGB LEDs' })).toHaveCount(
      0
    );
    await page.locator('.blocklyToolboxCategory', { hasText: 'Extensions' }).click();
    await page.locator('.blocklyFlyout .blocklyFlyoutButton', { hasText: 'RGB LEDs' }).click();
    await expect(
      page.locator('.blocklyToolboxCategoryLabel', { hasText: 'RGB LEDs' })
    ).toBeVisible();
  });
});

test.describe('on-screen micro:bit (M3 step 4)', () => {
  const simulator = (page: Page) => page.frameLocator('iframe[title="On-screen micro:bit"]');
  const litLeds = (page: Page) =>
    simulator(page)
      .locator('#LEDsOn > *')
      .evaluateAll(
        (leds) => leds.filter((led) => (led as SVGElement).style.display === 'inline').length
      );

  test('runs the blocks and lights the LEDs', async ({ page }) => {
    await openEditor(page);
    await importHeart(page);
    await simulator(page).locator('.play-button').click();
    await expect.poll(() => litLeds(page), { timeout: 15_000 }).toBeGreaterThan(10);
  });

  test('shows the motor turning when the program drives pins P0 and P1', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'My programs' }).click();
    const motorFile = JSON.stringify({
      format: 'robot-for-all-program',
      version: 1,
      name: 'Motor test',
      program: {
        version: 1,
        handlers: [{ type: 'on_start', body: [{ type: 'motor', action: 'forward' }] }]
      }
    });
    await page.getByLabel('Open a file').setInputFiles({
      name: 'motor.rfa.json',
      mimeType: 'application/json',
      buffer: Buffer.from(motorFile)
    });
    await simulator(page).locator('.play-button').click();
    await expect(page.locator('.motor')).toHaveText('forward', { timeout: 15_000 });
  });

  test('runs Python the learner types', async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await openEditor(page);
    await page.getByRole('tab', { name: 'Python' }).click();
    await page.getByRole('button', { name: 'Edit as Python' }).click();
    await page
      .getByLabel('Your MicroPython program')
      .fill('from microbit import *\npin1.write_digital(1)\ndisplay.show(Image.SQUARE)\n');
    // The Run button next to the code starts the on-screen micro:bit.
    await page.locator('#panel-python').getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('.motor')).toHaveText('backward', { timeout: 15_000 });
    await expect.poll(() => litLeds(page), { timeout: 15_000 }).toBe(16);
    // Typed Python is kept after a reload.
    await page.reload();
    await page.getByRole('tab', { name: 'Python' }).click();
    await expect(page.getByLabel('Your MicroPython program')).toHaveValue(/Image\.SQUARE/);
  });
});

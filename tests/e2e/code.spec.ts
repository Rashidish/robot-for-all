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

  test('a Phase 2 lesson opens its starter program in the editor', async ({ page }) => {
    for (const [id, name, python] of [
      ['p2-display-01', 'Blink a heart', 'display.show(Image.HEART)'],
      ['p2-motor-02', 'Forward, stop, reverse', 'rfa_robot.motor("left", -100)'],
      ['p2-robot-01', 'Robot that reacts', 'accelerometer.was_gesture("shake")']
    ] as const) {
      await page.goto(`/lessons/${id}/`);
      await page.getByRole('link', { name: 'Open the starter program in the code editor' }).click();
      await expect(page.locator('.blocklySvg').first()).toBeVisible();
      await expect(page.getByLabel('Program name')).toHaveValue(name);
      expect(page.url()).not.toContain('#open=');
      await page.getByRole('tab', { name: 'Python' }).click();
      await expect(page.locator('#panel-python code')).toContainText(python);
    }
    // Opening the same lesson again makes a second copy with its own name.
    await page.goto('/lessons/p2-display-01/');
    await page.getByRole('link', { name: 'Open the starter program in the code editor' }).click();
    await expect(page.getByLabel('Program name')).toHaveValue('Blink a heart 2');
  });

  test('a file that is not a program is refused', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'My programs' }).click();
    await page.getByLabel('Open a file').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"x":1}')
    });
    await expect(page.locator('p.status')).toHaveText("That file isn't a Robots For All program.");
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
    page.once('dialog', (prompt) => void prompt.accept('Robot dance'));
    await dialog.getByRole('button', { name: 'New' }).click();
    await expect(page.getByLabel('Program name')).toHaveValue('Robot dance');
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

    test(`the editor is never wider than the screen (${name})`, async ({ browser }) => {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      await page.goto(CODE);
      await expect(page.locator('.blocklySvg').first()).toBeVisible();
      for (const summary of await page.locator('details.sensors summary').all())
        await summary.click();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
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

  test('shows the motor turning from the robot calls the program makes', async ({ page }) => {
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

  test('motor driver extension: two motors with speed', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'My programs' }).click();
    const drive = (motor: string, dir: string, speed: number) => ({
      type: 'x_drive',
      motor,
      dir,
      speed: { type: 'number', value: speed }
    });
    await page.getByLabel('Open a file').setInputFiles({
      name: 'drive.rfa.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: 'robot-for-all-program',
          version: 1,
          name: 'Two motors',
          program: {
            version: 1,
            handlers: [
              { type: 'on_start', body: [drive('A', 'forward', 75), drive('B', 'backward', 40)] }
            ]
          }
        })
      )
    });
    // The extension's category appears because the program uses its blocks.
    await expect(page.locator('.blocklyToolboxCategory', { hasText: 'Robot' })).toBeVisible();
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('.motor')).toHaveText('forward', { timeout: 15_000 });
    await expect(page.locator('.outputs .speed').first()).toHaveText('75%');
    await expect(page.locator('.motor-b')).toHaveText('backward');
    await expect(page.locator('.outputs .speed').nth(1)).toHaveText('40%');
  });

  test('robot sensors: pressing the left whisker makes the program back up', async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await openEditor(page);
    await page.getByRole('tab', { name: 'Python' }).click();
    await page.getByRole('button', { name: 'Edit as Python' }).click();
    await page
      .getByLabel('Your MicroPython program')
      .fill(
        [
          'from microbit import *',
          'import rfa_robot',
          'while True:',
          '    if rfa_robot.whisker("left"):',
          '        rfa_robot.motor("left", -60)',
          '    else:',
          '        rfa_robot.motor("left", 60)',
          '    sleep(20)',
          ''
        ].join('\n')
      );
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('.motor')).toHaveText('forward', { timeout: 15_000 });
    await expect(page.locator('.outputs .speed').first()).toHaveText('60%');
    await page.getByText('Robot sensors').click();
    await page.getByLabel('Left whisker pressed').check();
    await expect(page.locator('.motor')).toHaveText('backward');
    await page.getByLabel('Left whisker pressed').uncheck();
    await expect(page.locator('.motor')).toHaveText('forward');
  });

  test('Run switches the sound on for a laptop too (Windows Chrome)', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      viewport: { width: 1366, height: 768 }
    });
    const page = await context.newPage();
    await openEditor(page);
    await importHeart(page);
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    const state = () =>
      page
        .frameLocator('iframe[title="On-screen micro:bit"]')
        .locator('body')
        .evaluate(() => (window as unknown as { rfaAudioState?: () => string }).rfaAudioState?.());
    await expect.poll(state, { timeout: 15_000 }).toBe('running');
    await context.close();
  });

  test("music plays on a laptop with Chrome's desktop sound rules", async ({
    playwright,
    baseURL
  }) => {
    // Desktop Chrome only lets a page make sound after a click in that page; Playwright's default
    // is more relaxed, so launch with the real desktop rule.
    const desktop = await playwright.chromium.launch({
      args: ['--autoplay-policy=document-user-activation-required']
    });
    const page = await desktop.newPage({ baseURL, viewport: { width: 1366, height: 768 } });
    // Record the state of the sound engine every time a sound is made, in every frame.
    await page.addInitScript(() => {
      const record = (ctx: BaseAudioContext) => {
        const top = window.top as unknown as { rfaSounds?: string[] };
        (top.rfaSounds ??= []).push(ctx.state);
      };
      const proto = BaseAudioContext.prototype;
      const source = proto.createBufferSource;
      const oscillator = proto.createOscillator;
      proto.createBufferSource = function (this: BaseAudioContext) {
        record(this);
        return source.call(this);
      };
      proto.createOscillator = function (this: BaseAudioContext) {
        record(this);
        return oscillator.call(this);
      };
    });
    await openEditor(page);
    await page.getByRole('button', { name: 'My programs' }).click();
    await page.getByLabel('Open a file').setInputFiles({
      name: 'tune.rfa.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: 'robot-for-all-program',
          version: 1,
          name: 'Tune',
          program: { version: 1, handlers: [] },
          python:
            'from microbit import *\nimport music\nwhile True:\n    music.play(["C4:4", "E4:4", "G4:4"])\n'
        })
      )
    });
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    const sounds = () =>
      page.evaluate(() => (window as unknown as { rfaSounds?: string[] }).rfaSounds ?? []);
    await expect
      .poll(async () => (await sounds()).includes('running'), { timeout: 15_000 })
      .toBe(true);
    // Test sound beeps from this page too.
    await page.getByRole('button', { name: /Test sound/ }).click();
    await expect(page.locator('.sound-off')).toHaveCount(0);
    await desktop.close();
  });

  test('Run switches the sound on (browsers only allow it after a tap)', async ({ page }) => {
    await openEditor(page);
    await importHeart(page);
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    const state = () =>
      page
        .frameLocator('iframe[title="On-screen micro:bit"]')
        .locator('body')
        .evaluate(() => (window as unknown as { rfaAudioState?: () => string }).rfaAudioState?.());
    await expect.poll(state, { timeout: 15_000 }).toBe('running');
  });

  test('the search box is never covered by the blocks (phone)', async ({ page }) => {
    await openEditor(page);
    const search = page.getByPlaceholder('Search blocks…');
    const onTop = await search.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
    });
    expect(onTop).toBe(true);
  });

  test('the Shake button shakes the on-screen micro:bit', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'My programs' }).click();
    const shakeFile = JSON.stringify({
      format: 'robot-for-all-program',
      version: 1,
      name: 'Shake test',
      program: {
        version: 1,
        handlers: [
          { type: 'x_on_gesture', gesture: 'shake', body: [{ type: 'show_icon', icon: 'HAPPY' }] }
        ]
      }
    });
    await page.getByLabel('Open a file').setInputFiles({
      name: 'shake.rfa.json',
      mimeType: 'application/json',
      buffer: Buffer.from(shakeFile)
    });
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    await page.waitForTimeout(500);
    expect(await litLeds(page)).toBe(0);
    await page.getByRole('button', { name: 'shake', exact: true }).click();
    // HAPPY lights 7 LEDs.
    await expect.poll(() => litLeds(page), { timeout: 15_000 }).toBe(7);
  });

  test('Game blocks run on screen (game.py is added for them)', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'My programs' }).click();
    const gameFile = JSON.stringify({
      format: 'robot-for-all-program',
      version: 1,
      name: 'Game test',
      program: {
        version: 1,
        handlers: [
          {
            type: 'on_start',
            body: [
              {
                type: 'set',
                name: 'player',
                value: {
                  type: 'x_sprite_create',
                  x: { type: 'number', value: 1 },
                  y: { type: 'number', value: 1 }
                }
              },
              {
                type: 'set',
                name: 'goal',
                value: {
                  type: 'x_sprite_create',
                  x: { type: 'number', value: 3 },
                  y: { type: 'number', value: 3 }
                }
              }
            ]
          }
        ]
      }
    });
    await page.getByLabel('Open a file').setInputFiles({
      name: 'game.rfa.json',
      mimeType: 'application/json',
      buffer: Buffer.from(gameFile)
    });
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    await expect.poll(() => litLeds(page), { timeout: 15_000 }).toBe(2);
  });

  test('switching back to Blocks runs the blocks, and keeps the Python as a named copy', async ({
    page
  }) => {
    // Confirm the switch, and name the Python copy when asked.
    page.on(
      'dialog',
      (dialog) =>
        void (dialog.type() === 'prompt' ? dialog.accept('Square in Python') : dialog.accept())
    );
    await openEditor(page);
    await page.getByRole('button', { name: 'My programs' }).click();
    const happyFile = JSON.stringify({
      format: 'robot-for-all-program',
      version: 1,
      name: 'Faces',
      program: {
        version: 1,
        handlers: [{ type: 'on_start', body: [{ type: 'show_icon', icon: 'HAPPY' }] }]
      }
    });
    await page.getByLabel('Open a file').setInputFiles({
      name: 'faces.rfa.json',
      mimeType: 'application/json',
      buffer: Buffer.from(happyFile)
    });
    await page.getByRole('tab', { name: 'Python' }).click();
    await page.getByRole('button', { name: 'Edit as Python' }).click();
    await page
      .getByLabel('Your MicroPython program')
      .fill('from microbit import *\ndisplay.show(Image.SQUARE)\n');
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    await expect(page.getByText('Running: your typed Python')).toBeVisible();
    await expect.poll(() => litLeds(page), { timeout: 15_000 }).toBe(16);
    // The Blocks tab switches back to the blocks: the happy face (7 LEDs) runs again.
    await page.getByRole('tab', { name: 'Blocks' }).click();
    await expect(page.getByText('Running: your blocks')).toBeVisible();
    await expect.poll(() => litLeds(page), { timeout: 15_000 }).toBe(7);
    // The running simulator keeps the page busy; a direct click event avoids scroll races.
    await page.getByRole('button', { name: 'My programs' }).dispatchEvent('click');
    await expect(page.getByRole('dialog').getByText('Square in Python')).toBeVisible();
  });

  test('runs Python the learner types', async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await openEditor(page);
    await page.getByRole('tab', { name: 'Python' }).click();
    await page.getByRole('button', { name: 'Edit as Python' }).click();
    await page
      .getByLabel('Your MicroPython program')
      .fill(
        'from microbit import *\nimport rfa_robot\nrfa_robot.motor("left", -100)\ndisplay.show(Image.SQUARE)\n'
      );
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('.motor')).toHaveText('backward', { timeout: 15_000 });
    await expect.poll(() => litLeds(page), { timeout: 15_000 }).toBe(16);
    // Typed Python is kept after a reload.
    await page.reload();
    await page.getByRole('tab', { name: 'Python' }).click();
    await expect(page.getByLabel('Your MicroPython program')).toHaveValue(/Image\.SQUARE/);
  });
});

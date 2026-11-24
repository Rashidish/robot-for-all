// M4 step 2: the Robot tab. The world is driven by the program running on the real MicroPython
// on-screen micro:bit, through robot calls (ADR-0008), and it answers the robot's sensors.
import { expect, test, type Page } from '@playwright/test';

const simulator = (page: Page) => page.frameLocator('iframe[title="On-screen micro:bit"]');

async function pressA(page: Page) {
  const a = simulator(page).locator('#ButtonA');
  await a.dispatchEvent('mousedown');
  await page.waitForTimeout(150);
  await a.dispatchEvent('mouseup');
}

test.describe('Robot tab (M4 step 2)', () => {
  test('"Robot that reacts" on the on-screen micro:bit stops inside the dark tunnel', async ({
    page
  }) => {
    await page.goto('/lessons/p2-robot-01/');
    await page.getByRole('link', { name: 'Open the starter program in the code editor' }).click();
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    // The lesson names its world (FR-8): the editor opens in the Robot view with it chosen.
    await expect(page.getByRole('button', { name: 'Robot', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByLabel('World', { exact: true })).toHaveValue('dark-tunnel');
    await expect(page.getByText('Drive into the dark tunnel and stop inside it.')).toBeVisible();
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    await expect(simulator(page).locator('#ButtonA')).toBeAttached({ timeout: 15_000 });
    // The program waits for button A, then drives while the light level is above 50.
    // The Monitor (FR-11) shows the light level as a table too, for screen readers.
    await page.locator('.monitor summary').click();
    const light = page.locator('.monitor tr[data-value="light"] td');
    await page.waitForTimeout(1500);
    await pressA(page);
    await expect(light).toHaveText('200', { timeout: 10_000 });
    await expect(page.locator('.monitor tr[data-value="motor_left"] td')).toHaveText('100%');
    await expect(page.locator('.robot-world .result')).toHaveText(/Challenge done!/, {
      timeout: 20_000
    });
    // The light level fell as the robot went into the tunnel, and the readout names the square.
    await expect(light).toHaveText('20');
    await expect(page.locator('.robot-world .readout')).toContainText('square F3');
    await page.getByLabel('Show the grid').check();
    // The run report is kept on the device, with no personal data.
    const report = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('rfa-run-reports-v1') ?? '{}')
    );
    expect(report['dark-tunnel']).toMatchObject({
      sim: 'rfa-sim/1',
      worldId: 'dark-tunnel',
      status: 'done'
    });
    // Keyboard and screen readers can ask where the robot is (FR-7).
    await page.getByRole('button', { name: 'Where is the robot?' }).click();
    await expect(page.locator('.robot-world [aria-live]')).toContainText('light 20');
  });

  test('the world fits a 360 px phone and answers a whisker program', async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    await page.goto('/code/');
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Python' }).click();
    await page.getByRole('button', { name: 'Edit as Python' }).click();
    await page
      .getByLabel('Your MicroPython program')
      .fill(
        [
          'from microbit import *',
          'import rfa_robot',
          'while True:',
          '    if rfa_robot.whisker("left") or rfa_robot.whisker("right"):',
          '        rfa_robot.stop()',
          '        display.show(Image.SAD)',
          '    else:',
          '        rfa_robot.motor("left", 100)',
          '        rfa_robot.motor("right", 100)',
          '    sleep(20)',
          ''
        ].join('\n')
      );
    await page.getByRole('button', { name: 'Robot', exact: true }).click();
    await page.getByLabel('World', { exact: true }).selectOption('simple-maze');
    const box = await page.locator('.robot-world canvas').boundingBox();
    expect(box?.width ?? 999).toBeLessThanOrEqual(360);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    // Driving east, the whiskers reach the island wall and the program stops both motors.
    await expect(page.locator('.motor')).toHaveText('forward', { timeout: 15_000 });
    await expect(page.locator('.motor')).toHaveText('stop', { timeout: 15_000 });
    await expect(page.locator('.motor-b')).toHaveText('stop');
  });

  test('maze courses: the same maze number draws the same maze; missions are listed', async ({
    page
  }) => {
    await page.goto('/code/');
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    await page.getByRole('button', { name: 'Robot', exact: true }).click();
    await page.getByLabel('World', { exact: true }).selectOption('bump-maze');
    const canvas = page.locator('.robot-world canvas');
    const picture = () => canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const number = page.getByLabel('Maze number');
    await number.fill('4817');
    await number.press('Enter');
    await number.blur();
    await page.waitForTimeout(300);
    const first = await picture();
    await number.fill('4818');
    await number.blur();
    await page.waitForTimeout(300);
    expect(await picture()).not.toBe(first);
    await number.fill('4817');
    await number.blur();
    await page.waitForTimeout(300);
    expect(await picture()).toBe(first);
    await page.getByLabel('Size').selectOption('6');
    await page.waitForTimeout(300);
    expect(await picture()).not.toBe(first);
    // The mission checklist (FR-17): name and points, not done before a run.
    const finish = page.locator('.missions li[data-mission="finish"]');
    await expect(finish).toContainText('Reach the finish');
    await expect(finish).toHaveAttribute('data-done', 'false');
  });

  test('Print course: true-size A4 pages with a calibration square and a build sheet', async ({
    page
  }) => {
    await page.goto('/code/');
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    // The print dialog can't be driven in a test: record that it was asked for.
    await page.evaluate(() => {
      window.print = () => {
        (window as unknown as { printed: boolean }).printed = true;
      };
    });
    await page.getByRole('button', { name: 'Robot', exact: true }).click();
    await page.getByLabel('World', { exact: true }).selectOption('bump-maze');
    await page.getByLabel('Maze number').fill('4817');
    await page.getByLabel('Maze number').blur();
    await page.getByRole('button', { name: 'Print course' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { printed?: boolean }).printed))
      .toBe(true);
    const pages = page.locator('.print-pages svg');
    // First page + 15 floor tiles + build sheet.
    await expect(pages).toHaveCount(17);
    await expect(pages.first()).toHaveAttribute('width', '210mm');
    await expect(pages.first()).toContainText('This square must measure 100 mm');
    await expect(pages.first()).toContainText('Bump maze 4817 (4 × 4)');
    await expect(pages.last()).toContainText('Build sheet');
    // On screen the pages stay hidden; only the printer sees them.
    await expect(page.locator('.print-pages')).toBeHidden();
  });

  test('"Two motors: turning": A drives both motors forward, B spins', async ({ page }) => {
    await page.goto('/lessons/p2-motor-03/');
    await page.getByRole('link', { name: 'Open the starter program in the code editor' }).click();
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    await expect(page.getByLabel('World', { exact: true })).toHaveValue('open-floor');
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    await expect(simulator(page).locator('#ButtonA')).toBeAttached({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    await page.locator('.monitor summary').click();
    const left = page.locator('.monitor tr[data-value="motor_left"] td');
    const right = page.locator('.monitor tr[data-value="motor_right"] td');
    await pressA(page);
    await expect(left).toHaveText('60%', { timeout: 5_000 });
    await expect(right).toHaveText('60%');
    await expect(left).toHaveText('0%', { timeout: 5_000 });
    const pressB = async () => {
      const b = simulator(page).locator('#ButtonB');
      await b.dispatchEvent('mousedown');
      await page.waitForTimeout(150);
      await b.dispatchEvent('mouseup');
    };
    await pressB();
    await expect(left).toHaveText('60%', { timeout: 5_000 });
    await expect(right).toHaveText('-60%');
  });

  test('"Whisker bumper": the starter feels its way out of the simple maze', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/lessons/p2-whisker-01/');
    await page.getByRole('link', { name: 'Open the starter program in the code editor' }).click();
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    await expect(page.getByLabel('World', { exact: true })).toHaveValue('simple-maze');
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('.robot-world .result')).toHaveText(/Challenge done!/, {
      timeout: 60_000
    });
  });

  test('"Follow the line": the starter, built from line-sensor blocks, finishes the line world', async ({
    page
  }) => {
    test.setTimeout(90_000);
    await page.goto('/lessons/p2-line-01/');
    await page.getByRole('link', { name: 'Open the starter program in the code editor' }).click();
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    await expect(page.getByLabel('World', { exact: true })).toHaveValue('follow-the-line');
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('.robot-world .result')).toHaveText(/Challenge done!/, {
      timeout: 60_000
    });
  });

  test('"Bump maze": the starter hugs a wall and gets out of the bump maze', async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/lessons/p2-maze-01/');
    await page.getByRole('link', { name: 'Open the starter program in the code editor' }).click();
    await expect(page.locator('.blocklySvg').first()).toBeVisible();
    await expect(page.getByLabel('World', { exact: true })).toHaveValue('bump-maze');
    await page.locator('.simulator').getByRole('button', { name: 'Run' }).click();
    await expect(page.locator('.robot-world .result')).toHaveText(/Challenge done!/, {
      timeout: 120_000
    });
  });
});

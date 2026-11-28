// The Machine library (spec docs/specs/machines.md, step 1) on a 360 px phone.
import { expect, test, waitForServiceWorker } from './fixtures';

const TOPIC = '/machines/gear-train/';

test.describe('Machines', () => {
  test('the Machines tab opens the library, grouped by family (FR-1)', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Machines' })
      .click();
    await expect(page).toHaveURL(/\/machines\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Machine library');
    await expect(page.getByRole('link', { name: 'Machines', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    for (const family of ['Gears', 'Cams and cranks', 'Wheels, axles and bearings']) {
      await expect(page.getByRole('heading', { level: 2, name: family })).toBeVisible();
    }
    await page.getByRole('link', { name: 'Gear train' }).click();
    await expect(page).toHaveURL(new RegExp(`${TOPIC}$`));
  });

  test('a topic page shows how it works, stand-ins and "Used in" (FR-2, FR-7)', async ({
    page
  }) => {
    await page.goto(TOPIC);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gear train');
    await expect(page.getByRole('img', { name: /Three meshing gears/ })).toBeVisible();
    for (const section of [
      '⚠ Safety',
      'Stand-ins and the real part',
      'How it works',
      'Try it',
      'Used in'
    ]) {
      await expect(page.getByRole('heading', { level: 2, name: section })).toBeVisible();
    }
    // Worked out from the lessons that list this topic in `machines`.
    await page.getByRole('link', { name: 'Spinning gear train' }).click();
    await expect(page).toHaveURL(/\/lessons\/p1-gear-01\/$/);
  });

  test('"learn first" is a suggestion that links to the other topic (FR-8)', async ({ page }) => {
    await page.goto(TOPIC);
    await page.getByRole('link', { name: 'Bushing' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bushing');
  });

  test('Machines pages fit a 360 px screen', async ({ page }) => {
    for (const path of ['/machines/', TOPIC, '/machines/crank/', '/machines/bushing/']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test('a visited topic opens with no signal (FR-9)', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await page.goto(TOPIC);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gear train');
    await context.setOffline(true);
    await page.goto('/');
    await page.goto(TOPIC);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gear train');
    await expect(page.getByRole('img', { name: /Three meshing gears/ })).toBeVisible();
  });
});

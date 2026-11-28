// The Machine library (spec docs/specs/machines.md, step 1) on a 360 px phone.
import { expect, LESSON, test, waitForServiceWorker } from './fixtures';

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

  test('the library filters topics by grade (FR-1)', async ({ page }) => {
    await page.goto('/machines/');
    await page.getByLabel('Grade').selectOption('3');
    await expect(page.getByRole('link', { name: 'Crank' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Gear train' })).toBeHidden();
    await expect(page.getByRole('heading', { level: 2, name: 'Gears' })).toBeHidden();
    await page.getByLabel('Grade').selectOption('');
    await expect(page.getByRole('link', { name: 'Gear train' })).toBeVisible();
  });

  test('a lesson shows "Parts in this robot"; a part opens its card (FR-6)', async ({ page }) => {
    await page.goto(LESSON);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Parts in this robot' })
    ).toBeVisible();
    const part = page.getByRole('link', { name: 'Bushing', exact: true });
    await part.click();
    const card = page.getByRole('dialog', { name: 'Bushing' });
    await expect(card).toBeVisible();
    await expect(card.getByText(/smooth sleeve an axle spins inside/)).toBeVisible();
    await expect(card.getByRole('img', { name: /straw/ })).toBeVisible();
    // Escape closes it, and focus goes back to the part that opened it.
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    await expect(part).toBeFocused();
    // The Close button closes it too; "More about" opens the full topic.
    await part.click();
    await card.getByRole('button', { name: 'Close' }).click();
    await expect(card).toBeHidden();
    await part.click();
    await card.getByRole('link', { name: 'More about Bushing' }).click();
    await expect(page).toHaveURL(/\/machines\/bushing\/$/);
  });

  test('a lesson saved for offline opens its part cards with no signal (FR-9)', async ({
    page,
    context
  }) => {
    await page.goto(LESSON);
    await waitForServiceWorker(page);
    await page.getByRole('button', { name: 'Download for offline' }).click();
    await expect(page.getByRole('button', { name: '✓ Saved for offline' })).toBeDisabled();
    await context.setOffline(true);
    await page.goto('/');
    await page.goto(LESSON);
    await page.getByRole('link', { name: 'Crank', exact: true }).click();
    const card = page.getByRole('dialog', { name: 'Crank' });
    await expect(card).toBeVisible();
    await expect(card.getByRole('img', { name: /crank disc/ })).toBeVisible();
  });

  test('the lessons list filters by part (FR-13)', async ({ page }) => {
    await page.goto('/lessons/?machine=bushing');
    await expect(page.getByLabel('Part')).toHaveValue('bushing');
    await expect(page.getByRole('link', { name: 'Crank-powered waving rhino' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Spinning gear train' })).toBeVisible();
    const lever = page.locator('[data-lesson][data-mechanism="lever"]').first();
    await expect(lever).toBeHidden();
  });
});

test.describe('Machines in other languages (step 3, FR-10)', () => {
  test('a translated topic shows in isiZulu, marked as a draft translation', async ({ page }) => {
    await page.goto('/zu/machines/bushing/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ibhushi');
    await expect(page.getByText('Ukuhumusha okusalungiswa: akukabuyekezwa.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Zama' })).toBeVisible();
    await expect(page.getByText('cishe u-2 cm, lufakwe othini lokosa')).toBeVisible();
  });

  test('an untranslated topic shows in English, marked as English, in the library and in a lesson card', async ({
    page
  }) => {
    await page.goto('/zu/machines/crank/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crank');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAttribute('lang', 'en');
    await expect(
      page.getByText('Akukabi bikho olimini lwakho, ngakho kuboniswa ngesiNgisi.')
    ).toBeVisible();
    await page.goto('/zu/machines/');
    await expect(page.getByRole('link', { name: 'Ibhushi' })).toBeVisible();
    await page.goto('/zu/lessons/p1-crank-01/');
    await page.locator('a[data-machine-card="crank"]').click();
    const card = page.getByRole('dialog');
    await expect(card).toBeVisible();
    await expect(
      card.getByText('Akukabi bikho olimini lwakho, ngakho kuboniswa ngesiNgisi.')
    ).toBeVisible();
  });
});

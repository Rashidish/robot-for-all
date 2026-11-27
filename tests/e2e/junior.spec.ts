// Junior (Grades R–2; spec docs/specs/junior.md, ADR-0019) on a 360 px phone: picture blocks are
// tapped into a row and drive the robot on a grid, one square per step. Found and tapped by their
// spoken names (what a screen reader says), the way a child taps the pictures without reading.
import { expect, test } from './fixtures';

const tap = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('group', { name: 'Blocks' }).getByRole('button', { name, exact: true }).click();

test.describe('Junior (Grades R–2)', () => {
  test('a 4×4 mission is solved with picture blocks, with two stars kept on the phone', async ({
    page
  }) => {
    await page.goto('/code/junior/#rhino-to-water');
    await expect(page.getByRole('heading', { name: 'Rhino to the water' })).toBeVisible();
    for (const b of ['Three times', 'Forward', 'Turn right', 'Three times', 'Forward']) {
      await tap(page, b);
    }
    const row = page.getByRole('list', { name: 'Your program' });
    await expect(row.getByRole('button')).toHaveCount(5);
    // Tapping a block in the row takes it out; tapping it back in puts it at the end.
    await row
      .getByRole('button', { name: /Forward/ })
      .last()
      .click();
    await expect(row.getByRole('button')).toHaveCount(4);
    await tap(page, 'Forward');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByText('Well done! The best way!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('img', { name: /The robot is at D4/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
    await page.reload();
    await expect(
      page.getByRole('button', { name: '2. Rhino to the water (2 stars)' })
    ).toBeVisible();
  });

  test('bumping a rock says try again and the robot stays put', async ({ page }) => {
    await page.goto('/code/junior/#rhino-to-water');
    for (const b of ['Forward', 'Turn right', 'Forward']) await tap(page, b);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByText('Oops, a rock! Try again.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('img', { name: /The robot is at B1/ })).toBeVisible();
  });

  test('the code editor links to Junior, and Junior works offline after a visit', async ({
    page,
    context
  }) => {
    await page.goto('/code/');
    await page.getByRole('link', { name: 'Junior' }).click();
    await expect(page).toHaveURL(/\/code\/junior\/$/);
    await expect(page.getByRole('heading', { name: 'Bee to the flower' })).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Bee to the flower' })).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await tap(page, 'Forward');
    await tap(page, 'Forward');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByText('Well done! The best way!')).toBeVisible({ timeout: 10_000 });
    await context.setOffline(false);
  });
});

import { expect, LESSON, SLIDES, TEMPLATE, test, waitForServiceWorker } from './fixtures';

test.describe('offline (M1 spec journeys B and C)', () => {
  test('the app installs: manifest and icons are valid', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await request.get(href ?? '')).json();
    expect(manifest.name).toBe('Robot For All');
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons as { src: string }[]) {
      expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    }
  });

  test('home, lessons and about work with no signal after the first visit', async ({
    page,
    context
  }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await context.setOffline(true);

    for (const [path, heading] of [
      ['/', 'From Cardboard to Innovation'],
      ['/lessons/', 'Lessons'],
      ['/about/', 'About Robot For All']
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    }
  });

  test('a page never opened shows the friendly offline page', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await context.setOffline(true);
    await page.goto('/privacy/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("You're offline");
  });

  test('Download for offline saves a lesson for use without signal', async ({ page, context }) => {
    await page.goto(LESSON);
    await waitForServiceWorker(page);

    const button = page.getByRole('button', { name: 'Download for offline' });
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.getByRole('button', { name: '✓ Saved for offline' })).toBeDisabled();

    await context.setOffline(true);
    await page.goto('/');
    await page.goto(LESSON);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crank-powered waving rhino');
    await expect(page.getByRole('heading', { level: 2, name: 'Make' })).toBeVisible();
    // It remembers the lesson is saved.
    await expect(page.getByRole('button', { name: '✓ Saved for offline' })).toBeVisible();

    // Its slides were saved too, for a class with no signal.
    await page.goto(SLIDES);
    await expect(page.locator('.slide')).toHaveCount(9);

    // Its template was saved too, so it can be printed or copied with no signal.
    await page.goto(TEMPLATE);
    const sheet = page.getByRole('img', { name: 'Waving rhino: parts' });
    await expect(sheet).toBeVisible();
    await expect
      .poll(() => sheet.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });
});

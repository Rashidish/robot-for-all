import { expect, LESSON, test } from './fixtures';

test.describe('pages on a 360 px phone', () => {
  test('home page shows the promise and links to lessons', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'From Cardboard to Innovation'
    );
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await page.getByRole('link', { name: 'See the lessons' }).click();
    await expect(page).toHaveURL(/\/lessons\/$/);
  });

  test('a learner can open the sample lesson from the list', async ({ page }) => {
    await page.goto('/lessons/');
    await page.getByRole('link', { name: 'Crank-powered waving rhino' }).click();
    await expect(page).toHaveURL(LESSON);
    for (const step of ['Predict', 'Run', 'Investigate', 'Modify', 'Make']) {
      await expect(page.getByRole('heading', { level: 2, name: step })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'You will need' })).toBeVisible();
  });

  test('the current section is marked in the menu', async ({ page }) => {
    await page.goto(LESSON);
    await expect(page.getByRole('link', { name: 'Lessons', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('skip link moves keyboard users to the content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('unknown pages show the friendly 404 page', async ({ page }) => {
    const response = await page.goto('/no-such-page/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  });

  test('privacy page is linked from every page', async ({ page }) => {
    await page.goto('/about/');
    await page.getByRole('link', { name: 'Privacy' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy');
  });

  test('pages fit a 360 px screen without sideways scrolling', async ({ page }) => {
    for (const path of ['/', '/lessons/', LESSON, '/about/', '/privacy/']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test('pseudo-locale: pages still fit when text is 40% longer (future translations)', async ({
    page
  }) => {
    // Stand-in for a translated build: lengthen and accent every piece of text in place.
    const accents: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
    for (const path of ['/', LESSON]) {
      await page.goto(path);
      await page.evaluate((map) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.textContent ?? '';
          if (!text.trim()) continue;
          const accented = text.replace(/[aeiou]/g, (c) => map[c] ?? c);
          const extra = Math.ceil(text.length * 0.4);
          const padding = ' ~~~~'.repeat(Math.ceil(extra / 5)).slice(0, extra);
          node.textContent = `[${accented}${padding}]`;
        }
      }, accents);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test('printing hides menus and buttons', async ({ page }) => {
    await page.goto(LESSON);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('header.site-header')).toBeHidden();
    await expect(page.locator('footer.site-footer')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('screenshots at 360 px', async ({ page }, info) => {
    for (const [name, path] of [
      ['home', '/'],
      ['lessons', '/lessons/'],
      ['lesson', LESSON],
      ['about', '/about/'],
      ['privacy', '/privacy/']
    ] as const) {
      await page.goto(path);
      await page.screenshot({ path: info.outputPath(`${name}-360.png`), fullPage: true });
    }
  });
});

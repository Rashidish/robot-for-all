import { expect, LESSON, SLIDES, TEMPLATE, TEMPLATE_SVG, test } from './fixtures';

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
    await expect(page.getByRole('heading', { name: '⚠ Safety' })).toBeVisible();
    await expect(page.getByText('An adult must help with some steps.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'In this lesson you will' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Check your learning' })).toBeVisible();
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
    for (const path of ['/', '/lessons/', LESSON, SLIDES, TEMPLATE, '/about/', '/privacy/']) {
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

  test('a lesson links to its printable template, drawn at true A4 size', async ({
    page,
    request
  }) => {
    await page.goto(LESSON);
    await page.getByRole('link', { name: 'Waving rhino: parts' }).click();
    await expect(page).toHaveURL(TEMPLATE);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Waving rhino: parts');
    const sheet = page.getByRole('img', { name: 'Waving rhino: parts' });
    await expect(sheet).toBeVisible();
    await expect
      .poll(() => sheet.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect(
      page.getByRole('heading', { name: 'Measurements for drawing by hand' })
    ).toBeVisible();

    const svg = await (await request.get(TEMPLATE_SVG)).text();
    expect(svg).toContain('width="210mm" height="297mm"');
    expect(svg).toContain('This square must measure 50 mm');
  });

  test('slides view: one PRIMM step per slide, moved with buttons or arrow keys', async ({
    page
  }) => {
    await page.goto(LESSON);
    await page.getByRole('link', { name: 'Show as slides' }).click();
    await expect(page).toHaveURL(SLIDES);
    const slides = page.locator('.slide');
    await expect(slides).toHaveCount(9); // title, parts, safety, 5 PRIMM steps, checklist
    for (const step of ['Predict', 'Run', 'Investigate', 'Modify', 'Make']) {
      await expect(page.locator('.slide h2', { hasText: step })).toHaveCount(1);
    }
    const counter = page.locator('[data-counter]');
    await expect(counter).toHaveText('Slide 1 of 9');
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(counter).toHaveText('Slide 2 of 9');
    await page.locator('[data-deck]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('Slide 3 of 9');
    await page.keyboard.press('ArrowLeft');
    await expect(counter).toHaveText('Slide 2 of 9');
  });

  test('lesson filters narrow the list and remember the choice in the address', async ({
    page
  }) => {
    await page.goto('/lessons/');
    const rhino = page.getByRole('link', { name: 'Crank-powered waving rhino' });
    const crocodile = page.getByRole('link', { name: 'Snapping crocodile' });
    await expect(rhino).toBeVisible();
    await expect(crocodile).toBeVisible();

    await page.getByLabel('Mechanism').selectOption('crank');
    await expect(rhino).toBeVisible();
    await expect(crocodile).toBeHidden();
    await expect(page).toHaveURL(/\?mechanism=crank$/);

    // A shared link keeps the filter.
    await page.goto('/lessons/?mechanism=lever');
    await expect(page.getByLabel('Mechanism')).toHaveValue('lever');
    await expect(crocodile).toBeVisible();
    await expect(rhino).toBeHidden();

    // No match shows a helpful message.
    await page.goto('/lessons/?grade=12');
    await expect(page.getByText('No lessons match these filters.')).toBeVisible();
  });

  test('lessons link forward along the learning path', async ({ page }) => {
    await page.goto('/lessons/p1-lever-01/');
    await page.getByRole('link', { name: 'Rolling cardboard cart' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rolling cardboard cart');
    await page.getByRole('link', { name: 'Crank-powered waving rhino' }).last().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crank-powered waving rhino');
    await expect(page.getByRole('heading', { name: 'Do these lessons first' })).toBeVisible();
  });

  test('lesson diagrams load and have descriptions', async ({ page }) => {
    for (const id of ['p1-lever-01', 'p1-wheel-01', 'p1-crank-01']) {
      await page.goto(`/lessons/${id}/`);
      const img = page.locator('.lesson-body img').first();
      await expect(img).toBeVisible();
      expect((await img.getAttribute('alt'))?.length ?? 0).toBeGreaterThan(20);
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    }
  });

  test('a lesson links to its printable template, drawn at true A4 size', async ({
    page,
    request
  }) => {
    await page.goto(LESSON);
    await page.getByRole('link', { name: 'Waving rhino: parts' }).click();
    await expect(page).toHaveURL(TEMPLATE);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Waving rhino: parts');
    const sheet = page.getByRole('img', { name: 'Waving rhino: parts' });
    await expect(sheet).toBeVisible();
    await expect
      .poll(() => sheet.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect(
      page.getByRole('heading', { name: 'Measurements for drawing by hand' })
    ).toBeVisible();

    const svg = await (await request.get(TEMPLATE_SVG)).text();
    expect(svg).toContain('width="210mm" height="297mm"');
    expect(svg).toContain('This square must measure 50 mm');
  });

  test('slides view: one PRIMM step per slide, moved with buttons or arrow keys', async ({
    page
  }) => {
    await page.goto(LESSON);
    await page.getByRole('link', { name: 'Show as slides' }).click();
    await expect(page).toHaveURL(SLIDES);
    const slides = page.locator('.slide');
    await expect(slides).toHaveCount(9); // title, parts, safety, 5 PRIMM steps, checklist
    for (const step of ['Predict', 'Run', 'Investigate', 'Modify', 'Make']) {
      await expect(page.locator('.slide h2', { hasText: step })).toHaveCount(1);
    }
    const counter = page.locator('[data-counter]');
    await expect(counter).toHaveText('Slide 1 of 9');
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(counter).toHaveText('Slide 2 of 9');
    await page.locator('[data-deck]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('Slide 3 of 9');
    await page.keyboard.press('ArrowLeft');
    await expect(counter).toHaveText('Slide 2 of 9');
  });

  test('lesson filters narrow the list and remember the choice in the address', async ({
    page
  }) => {
    await page.goto('/lessons/');
    const card = page.getByRole('link', { name: 'Crank-powered waving rhino' });
    await page.getByLabel('Grade').selectOption('3');
    await expect(card).toBeVisible();
    await expect(page).toHaveURL(/\?grade=3$/);
    await page.getByLabel('Cost').selectOption('10');
    await expect(card).toBeHidden();
    await expect(page.getByText('No lessons match these filters.')).toBeVisible();
    await page.goto('/lessons/?grade=3');
    await expect(page.getByLabel('Grade')).toHaveValue('3');
    await expect(card).toBeVisible();
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
      ['slides', SLIDES],
      ['template', TEMPLATE],
      ['about', '/about/'],
      ['privacy', '/privacy/']
    ] as const) {
      await page.goto(path);
      await page.screenshot({ path: info.outputPath(`${name}-360.png`), fullPage: true });
    }
  });
});

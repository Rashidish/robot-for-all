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

    // The lesson diagram appears on its slide, with its description.
    const diagram = page.locator('.slide img').first();
    expect((await diagram.getAttribute('alt'))?.length ?? 0).toBeGreaterThan(20);
    await expect
      .poll(() => diagram.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
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
    await page.getByRole('link', { name: 'Extending grabber' }).last().click();
    await page.getByRole('link', { name: 'Bouncing animal box' }).last().click();
    await page.getByRole('link', { name: 'Robot arm with three lever types' }).last().click();
    for (const title of [
      'Waving robot (four-bar linkage)',
      'Spinning gear train',
      'Rubber-band pulley lift',
      'One-motor scribble robot'
    ]) {
      await page.getByRole('link', { name: title }).last().click();
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('One-motor scribble robot');
  });

  test('every lesson template sheet renders', async ({ request }) => {
    for (const path of [
      '/templates/p1-linkage-01/grabber-parts.svg',
      '/templates/p1-cam-01/cam-parts.svg',
      '/templates/p1-lever-02/lever-bench.svg',
      '/templates/p1-lever-02/robot-arm.svg',
      '/templates/p1-linkage-02/waving-robot.svg',
      '/templates/p1-gear-01/gear-train.svg',
      '/templates/p1-pulley-01/pulley-parts.svg',
      '/templates/p1-motor-01/scribble-bot.svg',
      '/templates/p2-whisker-01/whisker-bumper.svg',
      '/templates/p2-maze-01/wall-pieces.svg',
      '/templates/p2-maze-01/tunnel-and-gate.svg',
      '/templates/p2-art-01/pen-lifter.svg'
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(await res.text()).toContain('50 mm');
    }
  });

  test('lesson diagrams load and have descriptions', async ({ page }) => {
    for (const id of [
      'p1-lever-01',
      'p1-wheel-01',
      'p1-crank-01',
      'p1-linkage-01',
      'p1-cam-01',
      'p1-lever-02',
      'p1-linkage-02',
      'p1-gear-01',
      'p1-pulley-01',
      'p1-motor-01',
      'p2-display-01',
      'p2-button-01',
      'p2-light-01',
      'p2-motor-01',
      'p2-motor-02',
      'p2-robot-01',
      'p2-motor-03',
      'p2-whisker-01',
      'p2-line-01',
      'p2-maze-01',
      'p2-art-01',
      'p3-linemaze-01'
    ]) {
      await page.goto(`/lessons/${id}/`);
      const img = page.locator('.lesson-body img').first();
      await expect(img).toBeVisible();
      expect((await img.getAttribute('alt'))?.length ?? 0).toBeGreaterThan(20);
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    }
  });

  test('every lesson has a one-page answer sheet', async ({ page }) => {
    const ids = [
      'p1-lever-01',
      'p1-wheel-01',
      'p1-crank-01',
      'p1-linkage-01',
      'p1-cam-01',
      'p1-lever-02',
      'p1-linkage-02',
      'p1-gear-01',
      'p1-pulley-01',
      'p1-motor-01',
      'p2-display-01',
      'p2-button-01',
      'p2-light-01',
      'p2-motor-01',
      'p2-motor-02',
      'p2-robot-01',
      'p2-motor-03',
      'p2-whisker-01',
      'p2-line-01',
      'p2-maze-01',
      'p2-art-01',
      'p3-linemaze-01'
    ];
    await page.goto('/lessons/p2-light-01/');
    // "Code for this lesson" sits just before the syllabus links (owner, 2026-11-23).
    const headings = await page.locator('main h2').allTextContents();
    const code = headings.indexOf('Code for this lesson');
    expect(code).toBeGreaterThan(0);
    expect(headings[code + 1]).toBe('Links to the school syllabus');
    await page.getByRole('link', { name: 'Print the answer sheet' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Answer sheet: Automatic night light'
    );
    await expect(page.getByText('Learner or team name (no surnames)')).toBeVisible();
    await expect(page.getByText('What will the micro:bit show in a bright room?')).toBeVisible();
    await expect(page.locator('[data-sheet-code^="p2-light-01-"]')).toHaveCount(1);
    for (const id of ids) {
      await page.goto(`/lessons/${id}/answer-sheet/`);
      const pdf = await page.pdf({ preferCSSPageSize: true });
      const pages = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
      expect(pages.length, `${id} answer sheet pages`).toBe(1);
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

test.describe('a second language (more content spec §2.5)', () => {
  test('isiZulu pages exist in this build, link to each other, and say they are isiZulu', async ({
    page
  }) => {
    await page.goto('/zu/lessons/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zu');
    await expect(page.locator('.site-header a[aria-current="page"]')).toHaveAttribute(
      'href',
      '/zu/lessons/'
    );
    // The interface is in isiZulu (any missing word would fall back to English).
    await expect(page.locator('h1')).toHaveText('Izifundo');
    const card = page.locator('article.card a').first();
    await expect(card).toHaveAttribute('href', /^\/zu\/lessons\//);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      '/lessons/'
    );
  });

  test('the language switch goes to the same page and is remembered on this device', async ({
    page
  }) => {
    await page.goto('/lessons/');
    // The switch's own label is translated ("Ulimi" in isiZulu); the language names are not.
    const languages = page.locator('nav.languages');
    const zulu = languages.getByRole('link', { name: 'isiZulu' });
    await expect(zulu).toHaveAttribute('href', '/zu/lessons/');
    await zulu.click();
    await expect(page).toHaveURL(/\/zu\/lessons\/$/);
    // Opening an English page again goes to the remembered language.
    await page.goto('/about/');
    await expect(page).toHaveURL(/\/zu\/about\/$/);
    // Choosing English is remembered too.
    await expect(languages).toHaveAttribute('aria-label', 'Ulimi');
    await languages.getByRole('link', { name: 'English' }).click();
    await page.goto('/about/');
    await expect(page).toHaveURL(/\/about\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

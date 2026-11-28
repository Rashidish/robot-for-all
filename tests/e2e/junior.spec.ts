// Junior (Grades R–2; spec docs/specs/junior.md, ADR-0019) on a 360 px phone: picture cards are
// tapped into a row and drive the robot on a grid, the way CAPS writes moves for each grade. Found and tapped by their
// spoken names (what a screen reader says), the way a child taps the pictures without reading.
import { expect, test } from './fixtures';

const tap = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('group', { name: 'Blocks' }).getByRole('button', { name, exact: true }).click();

test.describe('Junior (Grades R–2)', () => {
  test('a Grade 1 mission: direction arrows with the repeat number under the card (CAPS)', async ({
    page
  }) => {
    await page.goto('/code/junior/#rhino-to-water');
    await expect(page.getByRole('heading', { name: 'Rhino to the water' })).toBeVisible();
    const row = page.getByRole('list', { name: 'Your program' });
    // A number needs a card to go under first.
    await tap(page, 'Three times');
    await expect(page.getByText('Tap an arrow first, then the number.')).toBeAttached();
    await expect(row.getByRole('button')).toHaveCount(0);
    for (const b of ['Go right', 'Three times', 'Go down', 'Three times']) await tap(page, b);
    // Two cards, each with its number under it.
    await expect(row.getByRole('button')).toHaveCount(2);
    await expect(row.getByRole('button', { name: /^Go down, Three times/ })).toBeVisible();
    // Tapping a card in the row takes it out, number and all; tap it back in.
    await row.getByRole('button', { name: /^Go down, Three times/ }).click();
    await expect(row.getByRole('button')).toHaveCount(1);
    for (const b of ['Go down', 'Three times']) await tap(page, b);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByText('Well done! The best way!')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('img', { name: /The robot is at D4/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
    await page.reload();
    await expect(
      page.getByRole('button', { name: '7. Rhino to the water (2 stars)' })
    ).toBeVisible();
  });

  test('bumping a rock says try again and the robot stays put', async ({ page }) => {
    await page.goto('/code/junior/#rhino-to-water');
    for (const b of ['Go down', 'Go right']) await tap(page, b);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByText('Oops, a rock! Try again.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('img', { name: /The robot is at A2/ })).toBeVisible();
  });

  test('a Grade 2 mission uses forward and turns', async ({ page }) => {
    await page.goto('/code/junior/#bus-to-school');
    const blocks = page.getByRole('group', { name: 'Blocks' });
    for (const b of ['Forward', 'Turn left', 'Turn right']) {
      await expect(blocks.getByRole('button', { name: b, exact: true })).toBeVisible();
    }
    await expect(blocks.getByRole('button', { name: 'Go up', exact: true })).toHaveCount(0);
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
    // Grade R: one arrow slides the bee until the edge stops it (CAPS Terms 1–2).
    await tap(page, 'Go right');
    await tap(page, 'Go down');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByText('Well done! The best way!')).toBeVisible({ timeout: 10_000 });
    await context.setOffline(false);
  });
});

test.describe('Junior printables and projector (step 2)', () => {
  const pdfPages = async (page: import('@playwright/test').Page) => {
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  };

  test('arrow cards print on two A4 pages; each mission sheet on one', async ({ page }) => {
    await page.goto('/code/junior/');
    await page.getByRole('link', { name: 'Arrow cards' }).click();
    await expect(page).toHaveURL(/\/code\/junior\/cards\/$/);
    await expect(page.getByRole('heading', { name: 'Arrow cards' })).toBeVisible();
    expect(await pdfPages(page)).toBe(2);
    for (const id of ['bee-to-flower', 'rhino-to-water', 'bus-to-school']) {
      await page.goto(`/code/junior/sheet/${id}/`);
      await expect(page.getByRole('img').first()).toBeVisible();
      expect(await pdfPages(page), `${id} sheet pages`).toBe(1);
    }
  });

  test('each mission links to its sheet; Big screen makes the blocks bigger', async ({ page }) => {
    await page.goto('/code/junior/#rhino-to-water');
    await expect(page.getByRole('link', { name: 'Print this mission' })).toHaveAttribute(
      'href',
      '/code/junior/sheet/rhino-to-water/'
    );
    const forward = page
      .getByRole('group', { name: 'Blocks' })
      .getByRole('button', { name: 'Go right', exact: true });
    const before = (await forward.boundingBox())?.height ?? 0;
    const big = page.getByRole('button', { name: 'Big screen' });
    await big.click();
    await expect(big).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => (await forward.boundingBox())?.height ?? 0)
      .toBeGreaterThan(before);
    await big.click();
    await expect(big).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Junior mission kinds and card limits (step 4)', () => {
  const tap = (page: import('@playwright/test').Page, name: string) =>
    page.getByRole('group', { name: 'Blocks' }).getByRole('button', { name, exact: true }).click();

  test('predict: tap the square where the bee stops, then watch', async ({ page }) => {
    await page.goto('/code/junior/#bee-where-it-stops');
    await expect(page.locator('.task')).toHaveText('Where will it stop? Tap the square.');
    await expect(page.getByRole('group', { name: 'Blocks' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Square B2' }).click();
    await expect(page.getByText('Not quite. Watch, then try again.')).toBeVisible({
      timeout: 10_000
    });
    // Tapping the mission again starts it again.
    await page.getByRole('button', { name: /^2\. / }).click();
    await page.getByRole('button', { name: 'Square C2' }).click();
    await expect(page.getByText("Yes, that's right!")).toBeVisible({ timeout: 10_000 });
  });

  test('choose: the shortest way that works', async ({ page }) => {
    await page.goto('/code/junior/#rhino-shortest-way');
    await page.getByRole('button', { name: /^Way 3:/ }).click();
    await expect(page.getByText('Not quite. Watch, then try again.')).toBeVisible({
      timeout: 15_000
    });
    await page.getByRole('button', { name: /^Way 2:/ }).click();
    await expect(page.getByText("Yes, that's right!")).toBeVisible({ timeout: 15_000 });
  });

  test('complete: the given cards stay; fill the empty box', async ({ page }) => {
    await page.goto('/code/junior/#rhino-fill-the-gap');
    const row = page.getByRole('list', { name: 'Your program' });
    await expect(row.getByRole('img', { name: 'Empty box' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByText('Fill the empty box first.')).toBeVisible();
    await row
      .getByRole('button', { name: /^Go right/ })
      .first()
      .click();
    await expect(page.getByText('This card stays.')).toBeVisible();
    await tap(page, 'Go down');
    await expect(row.getByRole('img', { name: 'Empty box' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByText('Well done! The best way!')).toBeVisible({ timeout: 15_000 });
  });

  test('Parsons cards: each card once, with a count; a card limit says how many are left', async ({
    page
  }) => {
    await page.goto('/code/junior/#bee-pack-the-cards');
    const blocks = page.getByRole('group', { name: 'Blocks' });
    await blocks.getByRole('button', { name: 'Go right, 2 left' }).click();
    await blocks.getByRole('button', { name: 'Go down, 1 left' }).click();
    await blocks.getByRole('button', { name: 'Go right, 1 left' }).click();
    await expect(blocks.getByRole('button', { name: 'Go right, 0 left' })).toBeDisabled();
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByText('Well done! The best way!')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /^15\. / }).click();
    await expect(page.getByText('6 left', { exact: true })).toBeVisible();
    await tap(page, 'Forward');
    await expect(page.getByText('5 left', { exact: true })).toBeVisible();
  });

  test('shorten: it works already; fewer cards earn the stars', async ({ page }) => {
    await page.goto('/code/junior/#rhino-make-it-shorter');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByText('It works. Can you use fewer cards?')).toBeVisible({
      timeout: 15_000
    });
    await page.getByRole('button', { name: 'Clear' }).click();
    for (const b of ['Go right', 'Three times', 'Go down', 'Two times']) await tap(page, b);
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByText('Well done! The best way!')).toBeVisible({ timeout: 15_000 });
  });
});

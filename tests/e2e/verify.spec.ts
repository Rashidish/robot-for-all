// Check a certificate (M5 FR-29): anyone, no sign-in; never a name. /db/ is faked here.
import { expect, test } from './fixtures';

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
});

test.describe('check a certificate (M5)', () => {
  test('a code typed any way shows the badge, date and school; nothing about the learner', async ({
    page
  }) => {
    const asked: unknown[] = [];
    await page.route('**/db/rest/v1/rpc/verify_certificate', (route) => {
      asked.push(route.request().postDataJSON());
      return route.fulfill(
        json([
          {
            badge_id: 'lever-master',
            issued_on: '2026-11-25',
            issued_by_label: 'Sizwe Primary',
            valid: true
          }
        ])
      );
    });
    await page.goto('/verify/');
    await page.getByLabel('Certificate code').fill('rfa abcd 23');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('This certificate is real.')).toBeVisible();
    await expect(page.getByText('Lever Master')).toBeVisible();
    await expect(page.getByText('School or club: Sizwe Primary')).toBeVisible();
    expect(asked).toEqual([{ p_code: 'RFA-ABCD-23' }]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
  });

  test('from a QR link: a family certificate says "Awarded by Robots For All"; a withdrawn one says so', async ({
    page
  }) => {
    let valid = true;
    await page.route('**/db/rest/v1/rpc/verify_certificate', (route) =>
      route.fulfill(
        json([
          {
            badge_id: 'first-build',
            issued_on: '2026-11-25',
            issued_by_label: 'Robots For All',
            valid
          }
        ])
      )
    );
    await page.goto('/verify/#RFA-ABCD-23');
    await expect(page.getByText('Awarded by Robots For All')).toBeVisible();
    valid = false;
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText(/withdrawn and no longer counts/)).toBeVisible();
  });

  test('an unknown code says so', async ({ page }) => {
    await page.route('**/db/rest/v1/rpc/verify_certificate', (route) => route.fulfill(json([])));
    await page.goto('/verify/');
    await page.getByLabel('Certificate code').fill('RFA-ZZZZ-99');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByRole('alert')).toContainText('don’t know that code');
  });
});

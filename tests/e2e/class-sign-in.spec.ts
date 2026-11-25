// The teacher's view of how learners sign in, and QR sign-in cards (M5 step 5c, ADR-0013).
// /db/ and /signin/ are faked here.
import { expect, test } from './fixtures';

const LEARNER = '11111111-1111-4111-8111-111111111111';
const SECRET = 'cd'.repeat(32);
const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body)
});

test.describe('class sign-in (M5)', () => {
  test('a teacher sees who is locked, resets pictures, signs a learner out, makes QR cards', async ({
    page
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'rfa-session',
        JSON.stringify({
          accessToken: 'a1',
          refreshToken: 'r1',
          expiresAt: 4102444800,
          userId: 'u1'
        })
      )
    );
    let locked = true;
    const calls: { fn: string; body: unknown }[] = [];
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      const fn = /\/rpc\/(\w+)$/.exec(url.pathname)?.[1];
      if (fn) calls.push({ fn, body: route.request().postDataJSON() });
      switch (url.pathname) {
        case '/db/rest/v1/organisation_staff':
          return route.fulfill(
            json([
              {
                role: 'teacher',
                organisations: {
                  id: 'o1',
                  name: 'Sizwe Primary',
                  kind: 'school',
                  verified_at: '2026-11-25'
                }
              }
            ])
          );
        case '/db/rest/v1/classes':
          return route.fulfill(
            json([
              {
                id: 'c1',
                organisation_id: 'o1',
                name: 'Grade 4B',
                grade_band: '3-4',
                language: 'en',
                class_code: 'BCDFGH',
                enrol_token: 'f'.repeat(32)
              }
            ])
          );
        case '/db/rest/v1/rpc/class_learner_status':
          return route.fulfill(
            json([
              {
                learner_id: LEARNER,
                nickname: 'Thandi R',
                avatar: 'rocket',
                has_pin: true,
                locked
              },
              {
                learner_id: 'l2',
                nickname: 'Rocket',
                avatar: 'robot',
                has_pin: false,
                locked: false
              }
            ])
          );
        case '/db/rest/v1/rpc/reset_learner_pin':
          locked = false;
          return route.fulfill(json(null));
        case '/db/rest/v1/rpc/create_sign_in_cards':
          return route.fulfill(
            json([{ learner_id: LEARNER, nickname: 'Thandi R', avatar: 'rocket', secret: SECRET }])
          );
        default:
          return route.fulfill(json(fn ? null : []));
      }
    });

    await page.goto('/account/');
    await page.locator('summary', { hasText: 'Grade 4B' }).click();
    await page.locator('summary', { hasText: 'Learners and how they sign in' }).click();
    await expect(page.getByText('locked for 5 minutes')).toBeVisible();
    await expect(page.getByText('will choose pictures at first sign-in')).toBeVisible();

    await page.getByRole('button', { name: 'Reset pictures' }).click();
    await expect(page.getByRole('status')).toContainText('Reset');
    await expect(page.getByText('locked for 5 minutes')).toHaveCount(0);
    await page.getByRole('button', { name: 'Sign out everywhere' }).first().click();
    expect(calls.find((c) => c.fn === 'revoke_learner_sessions')?.body).toEqual({
      p_learner: LEARNER
    });

    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Make cards' }).click();
    const qr = page.getByRole('img', { name: 'QR sign-in code for Thandi R' });
    await expect(qr).toBeVisible();
    // The secret is only in the page (the QR code), never kept in storage.
    expect(
      await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))
    ).not.toContain(SECRET);
    await page.getByRole('button', { name: 'Withdraw all cards' }).click();
    await expect(qr).toHaveCount(0);
    expect(calls.some((c) => c.fn === 'revoke_sign_in_cards')).toBe(true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
  });

  test('scanning a card signs the learner in; a withdrawn card says so', async ({ page }) => {
    let valid = true;
    await page.route('**/signin/card', (route) => {
      const body = route.request().postDataJSON() as { secret: string };
      if (!valid || body.secret !== SECRET)
        return route.fulfill(json({ message: 'card not valid' }, 404));
      return route.fulfill(
        json({
          token: 'card.token.sig',
          expires_at: Math.floor(Date.now() / 1000) + 86400,
          learner: { id: LEARNER, nickname: 'Thandi R', avatar: 'rocket' }
        })
      );
    });
    await page.goto(`/class/#card=${SECRET}`);
    await expect(page).toHaveURL(/\/me\/$/);
    await expect(page.getByRole('heading', { name: /Hello, Thandi R/ })).toBeVisible();

    valid = false;
    await page.goto(`/class/#card=${SECRET}`);
    await expect(page.getByRole('status')).toContainText('doesn’t work any more');
    // The secret left the address.
    expect(new URL(page.url()).hash).toBe('');
  });
});

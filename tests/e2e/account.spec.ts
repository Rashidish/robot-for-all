// Your account (M5 step 3b): sign in with an emailed code, set the name others see, sign out.
// The /db/ proxy is faked here; the real one forwards to Supabase (ADR-0017).
import { expect, test } from './fixtures';

test.describe('your account (M5)', () => {
  test('a teacher signs in with an emailed code, saves their name and signs out', async ({
    page
  }) => {
    const calls: string[] = [];
    let name = '';
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      calls.push(`${route.request().method()} ${url.pathname}`);
      const reply = (body: unknown) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/db/auth/v1/otp') return reply({});
      if (url.pathname === '/db/auth/v1/verify')
        return reply({
          access_token: 'a1',
          refresh_token: 'r1',
          expires_in: 3600,
          user: { id: 'u1' }
        });
      if (url.pathname === '/db/rest/v1/rpc/touch_adult') {
        const body = route.request().postDataJSON() as { p_display_name?: string };
        if (body.p_display_name) name = body.p_display_name;
        return reply(null);
      }
      if (url.pathname === '/db/rest/v1/adults') return reply(name ? [{ display_name: name }] : []);
      if (url.pathname === '/db/auth/v1/logout') return reply({});
      return route.fulfill({ status: 404, body: '{}' });
    });

    await page.goto('/account/');
    await expect(page.locator('h1')).toHaveText('Your account');
    await page.getByLabel('Email address').fill('teacher@example.org');
    await page.getByRole('button', { name: 'Send me a code' }).click();
    await expect(page.getByRole('status')).toContainText('code');
    await page.getByLabel('Code from the email').fill('123456');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('You’re signed in.')).toBeVisible();
    await page.getByLabel(/Your name as others see it/).fill('Mrs Dlamini');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toHaveText('Saved.');

    // Still signed in after a reload (this device remembers the session).
    await page.reload();
    await expect(page.getByLabel(/Your name as others see it/)).toHaveValue('Mrs Dlamini');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByLabel('Email address')).toBeVisible();
    // Everything went through our own domain.
    expect(calls.every((c) => c.includes(' /db/'))).toBe(true);
    // Fits a 360 px phone.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
  });

  test('lesson pages load no account code', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'script') scripts.push(r.url());
    });
    await page.goto('/lessons/p1-crank-01/');
    await page.waitForLoadState('networkidle');
    expect(scripts.some((s) => /Account|account/.test(s))).toBe(false);
  });
});

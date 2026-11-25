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
      // No schools or classes yet.
      if (url.pathname.startsWith('/db/rest/v1/')) return reply([]);
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

  test('a teacher sees their school, makes a class and shares its enrolment link', async ({
    page
  }) => {
    const org = { id: 'o1', name: 'Sizwe Primary', kind: 'school', verified_at: null };
    const classes: Record<string, unknown>[] = [];
    const created: Record<string, unknown>[] = [];
    await page.addInitScript(() => {
      localStorage.setItem(
        'rfa-session',
        JSON.stringify({
          accessToken: 'a1',
          refreshToken: 'r1',
          expiresAt: 4102444800,
          userId: 'u1'
        })
      );
    });
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      const reply = (body: unknown) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      switch (url.pathname) {
        case '/db/rest/v1/adults':
          return reply([{ display_name: 'Mrs Dlamini' }]);
        case '/db/rest/v1/organisation_staff':
          return reply([{ role: 'admin', organisations: org }]);
        case '/db/rest/v1/classes':
          return reply(classes);
        case '/db/rest/v1/class_learners':
          return reply([{ class_id: 'c1' }, { class_id: 'c1' }]);
        case '/db/rest/v1/pending_enrolments':
          return reply([{ class_id: 'c1' }]);
        case '/db/rest/v1/rpc/create_class': {
          const body = route.request().postDataJSON() as Record<string, unknown>;
          created.push(body);
          classes.push({
            id: 'c1',
            organisation_id: 'o1',
            name: body['p_name'],
            grade_band: body['p_grade_band'],
            language: body['p_language'],
            class_code: 'BCDFGH',
            enrol_token: 'f'.repeat(32)
          });
          return reply('c1');
        }
        default:
          return reply(null);
      }
    });

    await page.goto('/account/');
    await expect(page.getByRole('heading', { name: 'Sizwe Primary' })).toBeVisible();
    await expect(page.getByText(/Waiting for verification/)).toBeVisible();
    await page.getByLabel(/Class name/).fill('Grade 4B Robotics');
    await page.getByRole('button', { name: 'Make the class' }).click();
    expect(created[0]).toMatchObject({
      p_org: 'o1',
      p_name: 'Grade 4B Robotics',
      p_grade_band: '3-4'
    });

    await page.locator('summary', { hasText: 'Grade 4B Robotics' }).click();
    await expect(page.locator('.code')).toHaveText('BCD FGH');
    await expect(page.getByText(/\/enrol\/#f{32}/)).toBeVisible();
    await expect(page.getByText('Learners: 2')).toBeVisible();
    await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Share on WhatsApp' })).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/\?text=/
    );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
  });
});

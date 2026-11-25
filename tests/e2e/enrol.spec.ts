// Enrol your child (M5 step 4a): a parent opens the class link, signs in with an emailed code,
// reads the notice, gives consent and enrols their child by nickname. /db/ is faked here.
import { expect, test } from './fixtures';

const TOKEN = '0123456789abcdef0123456789abcdef';

test.describe('enrol your child (M5)', () => {
  test('a parent enrols a child through the class link', async ({ page }) => {
    const enrolled: Record<string, unknown>[] = [];
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      const reply = (body: unknown) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      switch (url.pathname) {
        case '/db/auth/v1/otp':
          return reply({});
        case '/db/auth/v1/verify':
          return reply({
            access_token: 'a1',
            refresh_token: 'r1',
            expires_in: 3600,
            user: { id: 'u1' }
          });
        case '/db/rest/v1/rpc/enrol_child':
          enrolled.push(route.request().postDataJSON() as Record<string, unknown>);
          return reply('l1');
        default:
          return url.pathname.startsWith('/db/rest/v1/')
            ? reply(url.pathname.includes('/rpc/') ? null : [])
            : route.fulfill({ status: 404, body: '{}' });
      }
    });

    await page.goto(`/enrol/#${TOKEN}`);
    await page.getByLabel('Email address').fill('parent@example.org');
    await page.getByRole('button', { name: 'Send me a code' }).click();
    await page.getByLabel('Code from the email').fill('123456');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { name: /What we keep/ })).toBeVisible();
    const submit = page.getByRole('button', { name: 'Enrol my child' });
    await expect(submit).toBeDisabled();

    // A full name is refused; a first name with an initial is fine.
    await page.getByLabel('Your child’s nickname in the app').fill('Thandiwe Radebe');
    await page.getByLabel('Grade').selectOption('5');
    await page.getByLabel('Rocket').check();
    await page.getByLabel(/parent or legal guardian/).check();
    await page.getByLabel(/lesson records and badges/).check();
    await page.getByLabel(/teachers or coaches of this class/).check();
    await submit.click();
    await expect(page.getByRole('alert')).toContainText('full name');
    expect(enrolled).toHaveLength(0);

    await page.getByLabel('Your child’s nickname in the app').fill('Thandi R');
    await submit.click();
    await expect(page.getByText('Enrolled:')).toBeVisible();
    expect(enrolled).toEqual([
      {
        p_enrol_token: TOKEN,
        p_nickname: 'Thandi R',
        p_grade: 5,
        p_avatar: 'rocket',
        p_language: 'en',
        p_notice: '1.0'
      }
    ]);
    // The class token leaves the address once used.
    expect(new URL(page.url()).hash).toBe('');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
  });

  test('an incomplete link says so', async ({ page }) => {
    await page.goto('/enrol/#abc');
    await expect(page.getByText('This enrolment link is not complete.')).toBeVisible();
  });
});

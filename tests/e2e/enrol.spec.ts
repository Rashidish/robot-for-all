// Enrol your child (M5 step 4a): a parent opens the class link, signs in with an emailed code,
// reads the notice, gives consent and enrols their child by nickname; then manages the child
// from their account (step 4c). /db/ is faked here.
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

  test('a parent sees their child, saves a copy, takes them out of a class and deletes them', async ({
    page
  }) => {
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
    let children = [
      {
        id: 'l1',
        nickname: 'Thandi R',
        grade: 4,
        avatar: 'rocket',
        language: 'en',
        created_at: '2026-11-25T05:00:00Z'
      }
    ];
    let classes = [
      {
        learner_id: 'l1',
        class_id: 'c1',
        class_name: 'Grade 4B',
        organisation_name: 'Sizwe Primary'
      }
    ];
    const calls: { fn: string; body: unknown }[] = [];
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      const reply = (body: unknown) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      const rpc = /^\/db\/rest\/v1\/rpc\/(\w+)$/.exec(url.pathname)?.[1];
      if (rpc) calls.push({ fn: rpc, body: route.request().postDataJSON() });
      switch (url.pathname) {
        case '/db/rest/v1/learners':
          return reply(children);
        case '/db/rest/v1/rpc/my_children_classes':
          return reply(classes);
        case '/db/rest/v1/rpc/withdraw_consent':
          classes = [];
          return reply(null);
        case '/db/rest/v1/rpc/delete_learner':
          children = [];
          return reply(null);
        case '/db/rest/v1/sheet_records':
          return reply([{ learner_id: 'l1', lesson_id: 'p1-crank-01', steps_done: 5 }]);
        default:
          return url.pathname.startsWith('/db/rest/v1/')
            ? reply(rpc ? null : [])
            : route.fulfill({ status: 404, body: '{}' });
      }
    });

    await page.goto('/account/');
    await expect(page.getByRole('heading', { name: 'Your children' })).toBeVisible();
    await expect(page.getByText('Grade 4B · Sizwe Primary')).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save a copy of their records' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('thandi-r-portfolio.json');
    const saved = JSON.parse(
      await new Response((await file.createReadStream()) as unknown as ReadableStream).text()
    ) as { child: { nickname: string }; lesson_records: unknown[] };
    expect(saved.child.nickname).toBe('Thandi R');
    expect(saved.lesson_records).toEqual([{ lesson_id: 'p1-crank-01', steps_done: 5 }]);

    await page.getByRole('button', { name: 'Take out of this class' }).click();
    await expect(page.getByText(/Not in a class/)).toBeVisible();
    expect(calls.find((c) => c.fn === 'withdraw_consent')).toEqual({
      fn: 'withdraw_consent',
      body: { p_learner: 'l1', p_control: 'class', p_class: 'c1' }
    });

    await page.getByRole('button', { name: 'Delete this child’s profile' }).click();
    await expect(page.getByText(/cannot be undone/)).toBeVisible();
    await page.getByRole('button', { name: 'Yes, delete everything' }).click();
    await expect(page.getByRole('heading', { name: 'Your children' })).toHaveCount(0);
    await expect(page.getByText(/Nothing about your child is kept/)).toBeVisible();
    expect(calls.some((c) => c.fn === 'delete_learner')).toBe(true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
  });
});

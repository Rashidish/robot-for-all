// School and club enrolment (M5 step 4b, FR-5a): a teacher enrols learners for their parents;
// each parent confirms from the emailed link. /db/ and /cert/ are faked here.
import { expect, test } from './fixtures';

const SESSION = JSON.stringify({
  accessToken: 'a1',
  refreshToken: 'r1',
  expiresAt: 4102444800,
  userId: 'u1'
});
const TOKEN = 'ab'.repeat(32);
const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body)
});

test.describe('school enrolment (M5)', () => {
  test('a teacher enrols learners; the names go only to the certificate service', async ({
    page
  }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    const org = { id: 'o1', name: 'Sizwe Primary', kind: 'school', verified_at: '2026-11-25' };
    let pending: Record<string, unknown>[] = [];
    let sent: Record<string, unknown> | null = null;
    const cancelled: unknown[] = [];
    const dbBodies: string[] = [];
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      dbBodies.push(route.request().postData() ?? '');
      switch (url.pathname) {
        case '/db/rest/v1/organisation_staff':
          return route.fulfill(json([{ role: 'teacher', organisations: org }]));
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
        case '/db/rest/v1/pending_enrolments':
          return route.fulfill(json(pending));
        case '/db/rest/v1/rpc/cancel_pending_enrolment':
          cancelled.push(route.request().postDataJSON());
          pending = [];
          return route.fulfill(json(null));
        default:
          return route.fulfill(json(url.pathname.includes('/rpc/') ? null : []));
      }
    });
    await page.route('**/cert/enrol', async (route) => {
      sent = route.request().postDataJSON() as Record<string, unknown>;
      pending = [
        {
          id: 'p1',
          class_id: 'c1',
          grade: 4,
          requested_at: '2026-11-25T08:00:00Z',
          expires_at: '2026-12-09T08:00:00Z'
        },
        {
          id: 'p2',
          class_id: 'c1',
          grade: 5,
          requested_at: '2026-11-25T08:00:00Z',
          expires_at: '2026-12-09T08:00:00Z'
        }
      ];
      return route.fulfill(json({ sent: 2, failed: [] }));
    });

    await page.goto('/account/');
    await page.locator('summary', { hasText: 'Grade 4B' }).click();
    await page.locator('summary', { hasText: 'Enrol learners for their parents' }).click();
    await page.getByLabel('Child’s first name and surname').fill('Thandiwe Radebe');
    await page.getByLabel('Parent’s email address').fill('mom@example.org');
    await page.getByRole('button', { name: 'Add another learner' }).click();
    await page.getByLabel('Child’s first name and surname').nth(1).fill('Sipho Mokoena');
    await page.getByLabel('Grade', { exact: true }).nth(1).selectOption('5');
    await page.getByLabel('Parent’s email address').nth(1).fill('dad@example.org');
    await page.getByRole('button', { name: 'Send to the parents' }).click();
    await expect(page.getByRole('status')).toContainText('Emails sent to parents: 2');
    expect(sent).toEqual({
      class: 'c1',
      learners: [
        { name: 'Thandiwe Radebe', grade: 4, email: 'mom@example.org' },
        { name: 'Sipho Mokoena', grade: 5, email: 'dad@example.org' }
      ]
    });
    // Sent rows are forgotten; nothing went to /db/ or into storage.
    await expect(page.getByLabel('Child’s first name and surname')).toHaveValue('');
    expect(dbBodies.join()).not.toMatch(/Thandiwe|mom@/);
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toMatch(/Thandiwe|mom@/);

    await expect(page.getByText('Waiting for a parent to confirm')).toBeVisible();
    await page.getByRole('button', { name: 'Withdraw' }).first().click();
    expect(cancelled).toEqual([{ p_id: 'p1' }]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
  });

  test('without email set up, the teacher is told and nothing is kept', async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/db/rest/v1/organisation_staff')
        return route.fulfill(
          json([
            {
              role: 'teacher',
              organisations: { id: 'o1', name: 'Sizwe Primary', kind: 'school', verified_at: null }
            }
          ])
        );
      if (url.pathname === '/db/rest/v1/classes')
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
      return route.fulfill(json(url.pathname.includes('/rpc/') ? null : []));
    });
    await page.route('**/cert/enrol', (route) =>
      route.fulfill(json({ message: 'email not set up' }, 503))
    );
    await page.goto('/account/');
    await page.locator('summary', { hasText: 'Grade 4B' }).click();
    await page.locator('summary', { hasText: 'Enrol learners for their parents' }).click();
    await page.getByLabel('Child’s first name and surname').fill('Thandiwe Radebe');
    await page.getByLabel('Parent’s email address').fill('mom@example.org');
    await page.getByRole('button', { name: 'Send to the parents' }).click();
    await expect(page.getByRole('alert')).toContainText('not set up yet');
  });

  test('a parent confirms from the emailed link', async ({ page }) => {
    let confirmed: Record<string, unknown> | null = null;
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/db/auth/v1/otp') return route.fulfill(json({}));
      if (url.pathname === '/db/auth/v1/verify')
        return route.fulfill(
          json({ access_token: 'a1', refresh_token: 'r1', expires_in: 3600, user: { id: 'u1' } })
        );
      return route.fulfill(json(url.pathname.includes('/rpc/') ? null : []));
    });
    await page.route('**/cert/pending', (route) =>
      route.fulfill(json({ class_name: 'Grade 4B', organisation_name: 'Sizwe Primary', grade: 4 }))
    );
    await page.route('**/cert/confirm', async (route) => {
      confirmed = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill(json({ learner: 'l1', name_kept: true }));
    });

    await page.goto(`/enrol/confirm/#${TOKEN}`);
    await expect(page.locator('h1')).toHaveText('Confirm your child’s enrolment');
    await page.getByLabel('Email address').fill('mom@example.org');
    await page.getByRole('button', { name: 'Send me a code' }).click();
    await page.getByLabel('Code from the email').fill('123456');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/Sizwe Primary.*Grade 4B/)).toBeVisible();
    await page.getByLabel('Your child’s nickname in the app').fill('Thandi R');
    await page.getByLabel(/parent or legal guardian/).check();
    await page.getByLabel(/lesson records and badges/).check();
    await page.getByLabel(/teachers or coaches of this class/).check();
    await page.getByLabel(/Keep the name the school or club typed/).check();
    await page.getByRole('button', { name: 'Confirm and enrol my child' }).click();
    await expect(page.getByText('Enrolled:')).toBeVisible();
    expect(confirmed).toEqual({
      token: TOKEN,
      notice: '1.0',
      keep_name: true,
      nickname: 'Thandi R',
      avatar: 'robot',
      language: 'en'
    });
    expect(new URL(page.url()).hash).toBe('');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
  });

  test('a link opened with another email address says so', async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    await page.route('**/db/**', (route) => route.fulfill(json([])));
    await page.route('**/cert/pending', (route) =>
      route.fulfill(json({ message: 'other email' }, 403))
    );
    await page.goto(`/enrol/confirm/#${TOKEN}`);
    await expect(page.getByText(/sent to a different email address/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with another email' })).toBeVisible();
  });
});

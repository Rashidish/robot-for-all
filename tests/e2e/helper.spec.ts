// The AI helper panel (M6 step 5) on a 360 px phone: Common questions on a lesson page (offline once
// seen), an adult asking from their home page, a child asking on a lesson page, and the messages
// for limits and safety. /helper/ and /db/ are faked; nothing typed is stored on the phone.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const SESSION = JSON.stringify({
  accessToken: 'adult.token.sig',
  refreshToken: 'r1',
  expiresAt: 4102444800,
  userId: 'u1'
});
const FAQ = {
  items: [
    { item: 0, q: 'Why does the jaw not close?', a: 'Check the straw is straight.' },
    { item: 1, q: 'No split pins?', a: 'Use straw pieces with a knot of string.' }
  ]
};
const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
});

async function storedEverywhere(page: import('@playwright/test').Page) {
  return page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage));
}

test.describe('the AI helper (M6)', () => {
  test('Common questions on a lesson page, and a 👎 hides one', async ({ page, context }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    // On the context, so the service worker's own requests are answered too.
    await context.route('**/helper/faq/p1-crank-01*', (route) => route.fulfill(json(FAQ)));
    const downs: unknown[] = [];
    await page.route('**/helper/faq-down', async (route) => {
      downs.push(route.request().postDataJSON());
      return route.fulfill(json({ status: 'ok', hidden: true }));
    });
    await page.goto('/lessons/p1-crank-01/');
    await page.getByRole('button', { name: 'Ask the helper about this lesson' }).click();
    await expect(page.getByRole('heading', { name: 'Ask the helper' })).toBeVisible();
    await expect(page.getByText('Written by AI. AI can be wrong').first()).toBeVisible();
    await page.getByText('No split pins?').click();
    await expect(page.getByText('Use straw pieces with a knot of string.')).toBeVisible();
    await page
      .locator('details', { hasText: 'No split pins?' })
      .getByRole('button', { name: /This is wrong/ })
      .click();
    await expect(page.getByText('No split pins?')).toHaveCount(0);
    expect(downs).toEqual([{ lesson: 'p1-crank-01', language: 'en', item: 1 }]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);

    // Offline after a visit: the copy the service worker kept shows; asking needs a connection.
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    // Once the service worker controls the page, a visit saves the page and its questions.
    await page.reload();
    await page.getByRole('button', { name: 'Ask the helper about this lesson' }).click();
    await expect(page.getByText('Why does the jaw not close?')).toBeVisible();
    await context.unroute('**/helper/faq/p1-crank-01*');
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button', { name: 'Ask the helper about this lesson' }).click();
    await expect(page.getByText('Why does the jaw not close?')).toBeVisible();
    await expect(page.getByText('Asking needs a connection.')).toBeVisible();
    await context.setOffline(false);
  });

  test('an adult asks from their home page and once more; the answer carries the disclaimer', async ({
    page
  }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    await page.route('**/db/**', (route) =>
      route.fulfill(json(new URL(route.request().url()).pathname.includes('/rpc/') ? null : []))
    );
    const asked: { auth: string | undefined; body: Record<string, unknown> }[] = [];
    await page.route('**/helper/ask', async (route) => {
      const req = route.request();
      asked.push({
        auth: req.headers()['authorization'],
        body: req.postDataJSON() as Record<string, unknown>
      });
      return route.fulfill(
        json({
          status: 'ok',
          answer:
            asked.length === 1
              ? 'Count the teeth on each gear.'
              : 'Use two gears of 10 and 20 teeth.'
        })
      );
    });
    const thumbs: unknown[] = [];
    await page.route('**/helper/thumb', async (route) => {
      thumbs.push(route.request().postDataJSON());
      return route.fulfill(json({ status: 'ok' }));
    });

    await page.goto('/account/');
    await page.getByRole('button', { name: 'Ask the helper' }).click();
    await page.getByLabel('Your question').fill('How do I explain gear ratios to Grade 5?');
    await expect(page.getByText("Don't type learners' names")).toBeVisible();
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.getByText('Count the teeth on each gear.')).toBeVisible();
    await expect(page.getByText('Written by AI. AI can be wrong')).toBeVisible();
    expect(asked[0]).toEqual({
      auth: 'Bearer adult.token.sig',
      body: { question: 'How do I explain gear ratios to Grade 5?', page: 'home', language: 'en' }
    });
    await page.getByRole('button', { name: 'Helpful', exact: true }).click();
    await expect.poll(() => thumbs).toEqual([{ up: true }]);

    await page.getByLabel('Ask one more question about this').fill('Give an example');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.getByText('Use two gears of 10 and 20 teeth.')).toBeVisible();
    expect(asked[1]?.body['earlier']).toEqual({
      question: 'How do I explain gear ratios to Grade 5?',
      answer: 'Count the teeth on each gear.'
    });
    await expect(page.getByText('To ask about something new, open this page again.')).toBeVisible();
    expect(await storedEverywhere(page)).not.toMatch(/gear ratios|teeth/);
  });

  test('a child asks on a lesson page; limits and safety get kind messages', async ({ page }) => {
    await page.route('**/helper/faq/**', (route) => route.fulfill(json({ items: [] })));
    const replies = [
      { status: 'ok', answer: 'Try turning the crank slowly.' },
      { status: 'daily_cap' },
      { status: 'safety' }
    ];
    const asked: { auth: string | undefined; body: Record<string, unknown> }[] = [];
    await page.route('**/helper/ask', async (route) => {
      const req = route.request();
      asked.push({
        auth: req.headers()['authorization'],
        body: req.postDataJSON() as Record<string, unknown>
      });
      return route.fulfill(json(replies[asked.length - 1]));
    });
    // A child signed in on this phone (as /class/ leaves it).
    await page.goto('/class/');
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('rfa-learners', 1);
        req.onupgradeneeded = () =>
          req.result.createObjectStore('sessions', { keyPath: 'learnerId' });
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction('sessions', 'readwrite');
          tx.objectStore('sessions').put({
            learnerId: 'k1',
            nickname: 'Thandi R',
            avatar: 'rocket',
            token: 'kid.token.sig',
            expiresAt: Math.floor(Date.now() / 1000) + 86400
          });
          tx.oncomplete = () => resolve();
        };
      });
      sessionStorage.setItem('rfa-learner-now', JSON.stringify({ id: 'k1', at: Date.now() }));
    });

    await page.goto('/lessons/p1-crank-01/');
    await page.getByRole('button', { name: 'Ask the helper about this lesson' }).click();
    await expect(page.getByText("Don't type your name or where you live.")).toBeVisible();
    await expect(page.getByLabel('Your question')).toHaveAttribute('maxlength', '200');
    await page.getByLabel('Your question').fill('why does my rhino not wave');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.getByText('Try turning the crank slowly.')).toBeVisible();
    await expect(page.getByText('Ask an adult before using tools.')).toBeVisible();
    expect(asked[0]).toEqual({
      auth: 'Bearer kid.token.sig',
      body: {
        question: 'why does my rhino not wave',
        page: 'lesson',
        lesson: 'p1-crank-01',
        language: 'en'
      }
    });

    await page.getByLabel('Ask one more question about this').fill('and the jaw');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(
      "You've asked your questions for today. They come back tomorrow."
    );
    await page.getByLabel('Ask one more question about this').fill('i am scared');
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Childline on 116');
  });

  test('signed out: Common questions only, with where to sign in', async ({ page }) => {
    await page.route('**/helper/faq/**', (route) => route.fulfill(json(FAQ)));
    await page.goto('/lessons/p1-crank-01/');
    await page.getByRole('button', { name: 'Ask the helper about this lesson' }).click();
    await expect(page.getByText('Why does the jaw not close?')).toBeVisible();
    await expect(page.getByText('Sign in to ask your own question:')).toBeVisible();
    await expect(page.getByLabel('Your question')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /This is wrong/ })).toHaveCount(0);
    // The open panel passes the accessibility checks, in light and dark.
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      const results = await new AxeBuilder({ page })
        .include('.helper')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    }
  });
});

test.describe('AI helper controls (M6 step 6)', () => {
  test('a parent turns the helper on for their child, reading what is sent and kept, and off again', async ({
    page
  }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    const calls: unknown[] = [];
    let on = false;
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      switch (url.pathname) {
        case '/db/rest/v1/learners':
          return route.fulfill(
            json([
              {
                id: 'l1',
                nickname: 'Thandi R',
                grade: 4,
                avatar: 'rocket',
                language: 'en',
                created_at: '2026-11-25T05:00:00Z'
              }
            ])
          );
        case '/db/rest/v1/rpc/my_children_helper':
          return route.fulfill(json([{ learner_id: 'l1', helper_on: on }]));
        case '/db/rest/v1/rpc/set_helper_consent': {
          const body = route.request().postDataJSON() as { p_on: boolean };
          calls.push(body);
          on = body.p_on;
          return route.fulfill(json(null));
        }
        default:
          return route.fulfill(json(url.pathname.includes('/rpc/') ? null : []));
      }
    });
    await page.goto('/account/');
    await page.locator('summary', { hasText: 'AI helper' }).click();
    await expect(page.getByText('AI helper: off')).toBeVisible();
    await expect(page.getByText(/What is sent: no personal information is shared/)).toBeVisible();
    await expect(
      page.getByText(/never send your child's name, nickname, school or account/)
    ).toBeVisible();
    await expect(page.getByText(/outside South Africa/)).toBeVisible();
    await expect(page.getByText(/Childline is free on 116/)).toBeVisible();
    const turnOn = page.getByRole('button', { name: 'Turn the helper on' });
    await expect(turnOn).toBeDisabled();
    await page.getByLabel(/I allow my child to ask the AI helper/).check();
    await turnOn.click();
    await expect(page.getByRole('status')).toHaveText('The AI helper is on for your child.');
    await expect(page.getByText('AI helper: on')).toBeVisible();
    await page.getByRole('button', { name: 'Turn the helper off' }).click();
    await expect(page.getByText('AI helper: off')).toBeVisible();
    expect(calls).toEqual([
      { p_learner: 'l1', p_on: true, p_notice: '1.1' },
      { p_learner: 'l1', p_on: false, p_notice: null }
    ]);
  });

  test('a teacher switches the helper off for a class and sees only a count', async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    const calls: unknown[] = [];
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
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
            json(
              url.searchParams.get('select') === 'badges_need_check,helper_allowed'
                ? [{ badges_need_check: false, helper_allowed: true }]
                : [
                    {
                      id: 'c1',
                      organisation_id: 'o1',
                      name: 'Grade 4B',
                      grade_band: '3-4',
                      language: 'en',
                      class_code: 'BCDFGH',
                      enrol_token: 'f'.repeat(32)
                    }
                  ]
            )
          );
        case '/db/rest/v1/class_learners':
          return route.fulfill(
            json(
              url.searchParams.get('class_id')
                ? [{ learner_id: 'l1', learners: { nickname: 'Thandi R' } }]
                : [{ class_id: 'c1' }]
            )
          );
        case '/db/rest/v1/rpc/class_helper_count':
          return route.fulfill(json(12));
        case '/db/rest/v1/rpc/set_helper_allowed':
          calls.push(route.request().postDataJSON());
          return route.fulfill(json(null));
        default:
          return route.fulfill(json(url.pathname.includes('/rpc/') ? null : []));
      }
    });
    await page.goto('/account/');
    await page.locator('summary', { hasText: 'Grade 4B' }).click();
    await page.locator('summary', { hasText: /^Progress$/ }).click();
    await expect(page.getByText('Questions this week: 12')).toBeVisible();
    const box = page.getByLabel('Learners may ask the AI helper');
    await expect(box).toBeChecked();
    await box.uncheck();
    await expect.poll(() => calls).toEqual([{ p_class: 'c1', p_on: false }]);
  });
});

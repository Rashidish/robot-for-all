// Family groups (spec M5-family-and-personal, step 2): start one, add children, invite and
// confirm a second parent, and "Learn as <child>". /db/ and /signin/ are faked here.
import { expect, test } from './fixtures';

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body)
});
const SESSION = JSON.stringify({
  accessToken: 'a.parent.token',
  refreshToken: 'r1',
  expiresAt: 4102444800,
  userId: 'u1'
});

test.describe('family group (M5)', () => {
  test('a parent starts a family group, adds children, invites and confirms a second parent', async ({
    page
  }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    let familyClass: string | null = null;
    let members: { learner_id: string; learners: { nickname: string; avatar: string } }[] = [];
    let learners = [
      {
        id: 'l1',
        nickname: 'Thandi R',
        grade: 4,
        avatar: 'rocket',
        language: 'en',
        created_at: '2026-11-25'
      }
    ];
    let waiting: { id: string; display_name: string; accepted_at: string }[] = [];
    const calls: { fn: string; body: unknown }[] = [];
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      const fn = /\/rpc\/(\w+)$/.exec(url.pathname)?.[1];
      const body = fn ? route.request().postDataJSON() : null;
      if (fn) calls.push({ fn, body });
      switch (fn ?? url.pathname) {
        case 'my_family_class':
          return route.fulfill(json(familyClass));
        case 'create_family_group':
          familyClass = 'f1';
          return route.fulfill(json('f1'));
        case 'enrol_into_family':
          learners = [
            ...learners,
            {
              id: 'l2',
              nickname: 'Sipho M',
              grade: 5,
              avatar: 'robot',
              language: 'en',
              created_at: '2026-11-25'
            }
          ];
          members = [
            ...members,
            { learner_id: 'l2', learners: { nickname: 'Sipho M', avatar: 'robot' } }
          ];
          return route.fulfill(json('l2'));
        case 'add_to_family':
          members = [
            ...members,
            { learner_id: 'l1', learners: { nickname: 'Thandi R', avatar: 'rocket' } }
          ];
          return route.fulfill(json(null));
        case 'create_guardian_invitation':
          waiting = [{ id: 'i1', display_name: 'Mr Radebe', accepted_at: '2026-11-25T12:00:00Z' }];
          return route.fulfill(json('ab'.repeat(32)));
        case 'family_invitations_waiting':
          return route.fulfill(json(waiting));
        case 'confirm_guardian':
          waiting = [];
          return route.fulfill(json(null));
        case '/db/rest/v1/learners':
          return route.fulfill(json(learners));
        case '/db/rest/v1/classes':
          return route.fulfill(json(url.searchParams.get('id') ? [{ class_code: 'BCDFGH' }] : []));
        case '/db/rest/v1/class_learners':
          return route.fulfill(json(url.searchParams.get('class_id') ? members : []));
        default:
          return route.fulfill(json(fn ? null : []));
      }
    });

    await page.goto('/account/');
    const family = page.getByRole('region', { name: 'Family group' });
    await family.getByRole('button', { name: 'Start a family group' }).click();
    await expect(family.getByText('BCD FGH')).toBeVisible();

    // A child already enrolled elsewhere joins; a new child is added with the consents.
    await family.getByRole('button', { name: 'Add to the family group' }).click();
    await family.locator('summary', { hasText: 'Add a child' }).click();
    await family.getByLabel('Your child’s nickname in the app').fill('Sipho M');
    await family.getByLabel(/parent or legal guardian/).check();
    await family.getByLabel(/lesson records and badges/).check();
    await family.getByRole('button', { name: 'Add my child' }).click();
    await expect(family.getByRole('status')).toContainText('Added to your family group');
    expect(calls.find((c) => c.fn === 'enrol_into_family')?.body).toMatchObject({
      p_nickname: 'Sipho M',
      p_notice: '1.0'
    });

    // The second parent: a one-time link, then confirm the person who opened it.
    await family.getByRole('button', { name: 'Make a link' }).click();
    await expect(family.getByText(`/account/#guardian=${'ab'.repeat(32)}`)).toBeVisible();
    await expect(family.getByText('Mr Radebe')).toBeVisible();
    await family.getByRole('button', { name: 'Confirm' }).click();
    expect(calls.find((c) => c.fn === 'confirm_guardian')?.body).toEqual({ p_invitation: 'i1' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
  });

  test('“Learn as <child>” on the parent’s phone opens My page without the PIN', async ({
    page
  }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    let auth: string | null = null;
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/db/rest/v1/learners')
        return route.fulfill(
          json([
            {
              id: 'l1',
              nickname: 'Thandi R',
              grade: 4,
              avatar: 'rocket',
              language: 'en',
              created_at: '2026-11-25'
            }
          ])
        );
      return route.fulfill(json(url.pathname.includes('/rpc/') ? null : []));
    });
    await page.route('**/signin/as', (route) => {
      auth = route.request().headers()['authorization'] ?? null;
      return route.fulfill(
        json({
          token: 'learner.session.sig',
          expires_at: Math.floor(Date.now() / 1000) + 86400,
          learner: { id: 'l1', nickname: 'Thandi R', avatar: 'rocket' }
        })
      );
    });
    await page.goto('/account/');
    await page.getByRole('button', { name: 'Learn as Thandi R' }).click();
    await expect(page).toHaveURL(/\/me\/$/);
    await expect(page.getByRole('heading', { name: /Hello, Thandi R/ })).toBeVisible();
    expect(auth).toBe('Bearer a.parent.token');
  });

  test('a second parent opening the link is told the first parent will confirm', async ({
    page
  }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    const accepted: unknown[] = [];
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/db/rest/v1/rpc/accept_guardian_invitation') {
        accepted.push(route.request().postDataJSON());
        return route.fulfill(json(null));
      }
      return route.fulfill(json(url.pathname.includes('/rpc/') ? null : []));
    });
    await page.goto(`/account/#guardian=${'cd'.repeat(32)}`);
    await expect(page.getByText(/will confirm you/)).toBeVisible();
    expect(accepted).toEqual([{ p_token: 'cd'.repeat(32) }]);
    expect(new URL(page.url()).hash).toBe('');
  });

  test('an adult learning alone makes their own profile and starts learning', async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    let mine: string | null = null;
    let created: unknown = null;
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      switch (url.pathname) {
        case '/db/rest/v1/rpc/my_personal_learner':
          return route.fulfill(json(mine));
        case '/db/rest/v1/rpc/create_personal_learner':
          created = route.request().postDataJSON();
          mine = 'me1';
          return route.fulfill(json('me1'));
        case '/db/rest/v1/learners':
          // Their own profile is theirs, not one of their children.
          return route.fulfill(
            json(
              mine
                ? [
                    {
                      id: 'me1',
                      nickname: 'Sam',
                      grade: 12,
                      avatar: 'star',
                      language: 'en',
                      created_at: '2026-11-25'
                    }
                  ]
                : []
            )
          );
        default:
          return route.fulfill(json(url.pathname.includes('/rpc/') ? null : []));
      }
    });
    await page.route('**/signin/as', (route) =>
      route.fulfill(
        json({
          token: 'learner.session.sig',
          expires_at: Math.floor(Date.now() / 1000) + 86400,
          learner: { id: 'me1', nickname: 'Sam', avatar: 'star' }
        })
      )
    );
    await page.goto('/account/');
    const me = page.getByRole('region', { name: 'Learning myself' });
    await me.locator('summary').click();
    await me.getByLabel('Your nickname in the app').fill('Sam');
    await me.getByLabel('Star').check();
    const make = me.getByRole('button', { name: 'Make my learner profile' });
    await me.getByLabel('Keep my lesson records and badges.').check();
    await expect(make).toBeDisabled();
    await me.getByLabel('I am 18 or older.').check();
    await make.click();
    expect(created).toEqual({
      p_nickname: 'Sam',
      p_avatar: 'star',
      p_language: 'en',
      p_notice: '1.0',
      p_adult: true
    });
    await expect(page.getByRole('region', { name: 'Your children' })).toHaveCount(0);
    await me.getByRole('button', { name: 'Start learning' }).click();
    await expect(page).toHaveURL(/\/me\/$/);
    await expect(page.getByRole('heading', { name: /Hello, Sam/ })).toBeVisible();
  });
});

// Progress views (M5 step 6): the teacher's grid with spot-check and revoke, and a parent's view
// of their child. /db/ is faked; sheet codes come from the real /sheets.json.
import { expect, test } from './fixtures';

const SESSION = JSON.stringify({
  accessToken: 'a1',
  refreshToken: 'r1',
  expiresAt: 4102444800,
  userId: 'u1'
});
const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
});
const record = (over: Record<string, unknown>) => ({
  id: 'r1',
  learner_id: 'l1',
  lesson_id: 'p1-crank-01',
  sheet_code: 'p1-crank-01-81feed',
  steps_done: 99,
  i_can: [true, true, true],
  built_working: true,
  team_sheet: false,
  recorded_at: '2026-11-25T09:00:00Z',
  checked_at: null,
  revoked_at: null,
  ...over
});

test.describe('progress (M5)', () => {
  test('a teacher sees the grid, spot-checks one record and revokes another', async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    let records = [record({}), record({ id: 'r2', learner_id: 'l2', i_can: [true, false, true] })];
    const calls: unknown[] = [];
    let awards = [{ id: 'a1', learner_id: 'l1', badge_id: 'first-build' }];
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
        case '/db/rest/v1/class_learners':
          return route.fulfill(
            json(
              url.searchParams.get('class_id')
                ? [
                    { learner_id: 'l1', learners: { nickname: 'Thandi R' } },
                    { learner_id: 'l2', learners: { nickname: 'Rocket' } }
                  ]
                : [{ class_id: 'c1' }, { class_id: 'c1' }]
            )
          );
        case '/db/rest/v1/sheet_records':
          return route.fulfill(json(records));
        case '/db/rest/v1/badge_awards':
          return route.fulfill(json(awards));
        case '/db/rest/v1/rpc/set_badges_need_check':
          calls.push({ needCheck: route.request().postDataJSON() });
          return route.fulfill(json(null));
        case '/db/rest/v1/rpc/revoke_badge':
          calls.push({ revoke: route.request().postDataJSON() });
          awards = [];
          return route.fulfill(json(null));
        case '/db/rest/v1/rpc/check_record': {
          const body = route.request().postDataJSON() as { p_record: string; p_revoke: boolean };
          calls.push(body);
          records = records.map((r) =>
            r.id !== body.p_record
              ? r
              : body.p_revoke
                ? { ...r, revoked_at: '2026-11-25T12:00:00Z' }
                : { ...r, checked_at: '2026-11-25T12:00:00Z' }
          );
          return route.fulfill(json(null));
        }
        default:
          return route.fulfill(json(url.pathname.includes('/rpc/') ? null : []));
      }
    });

    await page.goto('/account/');
    await page.locator('summary', { hasText: 'Grade 4B' }).click();
    await page.locator('summary', { hasText: /^Progress$/ }).click();
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: /Crank/ })).toBeVisible();
    await expect(table.getByRole('button', { name: /Thandi R.*: done$/ })).toHaveText('✓');
    await expect(table.getByRole('button', { name: /Rocket.*Not yet.*1/ })).toHaveText('◐1');

    await table.getByRole('button', { name: /Thandi R/ }).click();
    await page.getByRole('button', { name: 'Mark as checked' }).click();
    await expect(table.getByRole('button', { name: /Thandi R.*checked by a teacher/ })).toHaveText(
      '✔'
    );

    await table.getByRole('button', { name: /Rocket/ }).click();
    await expect(page.getByText(/^Not yet: /)).toBeVisible();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: /Revoke \(it/ }).click();
    await expect(table.getByRole('button', { name: /Rocket/ })).toHaveCount(0);
    // Badges need a check, for this class.
    await page.getByLabel(/Badges need a teacher’s check/).check();
    // A badge awarded by mistake is revoked.
    await expect(page.getByText(/Thandi R:.*First Build/)).toBeVisible();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Revoke', exact: true }).click();
    await expect(page.getByText(/Thandi R:.*First Build/)).toHaveCount(0);
    expect(calls).toEqual([
      { p_record: 'r1', p_revoke: false },
      { p_record: 'r2', p_revoke: true },
      { needCheck: { p_class: 'c1', p_on: true } },
      { revoke: { p_award: 'a1' } }
    ]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
  });

  test('a parent sees their child’s lessons and what is “Not yet”', async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
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
              created_at: '2026-11-25T05:00:00Z'
            }
          ])
        );
      if (url.pathname === '/db/rest/v1/sheet_records')
        return route.fulfill(json([record({ i_can: [true, false, true] })]));
      if (url.pathname === '/db/rest/v1/badge_awards')
        return route.fulfill(json([{ badge_id: 'i-can' }]));
      return route.fulfill(json(url.pathname.includes('/rpc/') ? null : []));
    });
    await page.goto('/account/');
    await page.locator('summary', { hasText: /^Progress$/ }).click();
    const item = page.locator('li', { hasText: /Not yet: I can/ });
    await expect(item).toBeVisible();
    await expect(item).toContainText('Crank');
    await expect(page.getByRole('list', { name: 'Badges' })).toContainText('I Can!');
  });
});

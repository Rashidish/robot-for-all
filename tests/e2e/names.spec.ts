// Certificate names (M5 step 4d, ADR-0015): a parent adds the name, which goes only to the
// certificate service; a teacher at a verified school sees it on request, for 2 minutes, and it
// is never kept in the browser. /db/ and /cert/ are faked here.
import { expect, test } from './fixtures';

const SESSION = JSON.stringify({
  accessToken: 'a1',
  refreshToken: 'r1',
  expiresAt: 4102444800,
  userId: 'u1'
});
const reply = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: body === null ? '' : JSON.stringify(body)
});

async function storedEverywhere(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const parts = [JSON.stringify(localStorage), JSON.stringify(sessionStorage)];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) parts.push(req.url);
    }
    // IndexedDB too: learner sessions and outboxes live there (ADR-0013, ADR-0014).
    for (const info of await indexedDB.databases()) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(info.name as string);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error as Error);
      });
      for (const store of Array.from(db.objectStoreNames)) {
        const all = await new Promise<unknown[]>((resolve, reject) => {
          const req = db.transaction(store).objectStore(store).getAll();
          req.onsuccess = () => resolve(req.result as unknown[]);
          req.onerror = () => reject(req.error as Error);
        });
        parts.push(JSON.stringify(all));
      }
      db.close();
    }
    return parts.join('\n');
  });
}

test.describe('certificate names (M5)', () => {
  test('a parent adds their child’s name; only the certificate service receives it', async ({
    page
  }) => {
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    let sent: Record<string, unknown> | null = null;
    let has = false;
    const dbBodies: string[] = [];
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      dbBodies.push(route.request().postData() ?? '');
      if (url.pathname === '/db/rest/v1/learners')
        return route.fulfill(
          reply([
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
      if (url.pathname === '/db/rest/v1/rpc/has_certificate_name') return route.fulfill(reply(has));
      return route.fulfill(reply(url.pathname.includes('/rpc/') ? null : []));
    });
    await page.route('**/cert/name', async (route) => {
      sent = route.request().postDataJSON() as Record<string, unknown>;
      has = true;
      return route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/account/');
    await page.getByText('Name on certificates').click();
    await expect(page.getByText('Name on certificates: not added')).toBeVisible();
    const save = page.getByRole('button', { name: 'Save the name' });
    await page.getByLabel('First name and surname').fill('Thandiwe Radebe');
    await expect(save).toBeDisabled();
    await page.getByLabel(/Print this name on my child’s certificates/).check();
    await save.click();
    await expect(page.getByRole('status')).toContainText('stored locked');
    expect(sent).toEqual({ learner: 'l1', name: 'Thandiwe Radebe', notice: '1.0' });
    // The box is emptied, the name is never read back, and nothing kept it.
    await expect(page.getByLabel('Replace it with')).toHaveValue('');
    await expect(page.getByText('Name on certificates: added')).toBeVisible();
    expect(dbBodies.join()).not.toContain('Thandiwe');
    expect(await storedEverywhere(page)).not.toContain('Thandiwe');
  });

  test('a teacher sees the class’s names for 2 minutes, never stored', async ({ page }) => {
    await page.clock.install();
    await page.addInitScript((s) => localStorage.setItem('rfa-session', s), SESSION);
    const org = { id: 'o1', name: 'Sizwe Primary', kind: 'school', verified_at: '2026-11-25' };
    await page.route('**/db/**', async (route) => {
      const url = new URL(route.request().url());
      switch (url.pathname) {
        case '/db/rest/v1/organisation_staff':
          return route.fulfill(reply([{ role: 'teacher', organisations: org }]));
        case '/db/rest/v1/classes':
          return route.fulfill(
            reply([
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
            reply(
              url.searchParams.get('class_id')
                ? [
                    { learner_id: 'l1', learners: { nickname: 'Thandi R' } },
                    { learner_id: 'l2', learners: { nickname: 'Rocket' } }
                  ]
                : [{ class_id: 'c1' }, { class_id: 'c1' }]
            )
          );
        default:
          return route.fulfill(reply(url.pathname.includes('/rpc/') ? null : []));
      }
    });
    await page.route('**/cert/show-names', (route) =>
      route.fulfill(reply({ names: [{ learner: 'l1', name: 'Thandiwe R.' }] }))
    );

    await page.goto('/account/');
    await page.locator('summary', { hasText: 'Grade 4B' }).click();
    await page.getByRole('button', { name: 'Show first names' }).click();
    const table = page.getByRole('table');
    await expect(table.getByRole('row', { name: /Thandi R.*Thandiwe R\./ })).toBeVisible();
    await expect(table.getByRole('row', { name: /Rocket.*not given/ })).toBeVisible();
    expect(await storedEverywhere(page)).not.toContain('Thandiwe');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);

    // Still shown after 2 minutes: it is a toggle now (owner, 2026-11-27).
    await page.clock.fastForward('02:01');
    await expect(page.getByText('Thandiwe R.')).toBeVisible();
    // Switching back hides them at once.
    await page.getByRole('button', { name: 'Show nicknames only' }).click();
    await expect(page.getByText('Thandiwe R.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show first names' })).toBeVisible();
  });
});

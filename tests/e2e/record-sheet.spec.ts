// Recording an answer sheet offline (M5 step 5b, answer-sheets Part B, ADR-0014). The learner's
// session is put on the phone directly; /db/ is faked.
import { expect, test } from './fixtures';

const LEARNER = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'learner.token.sig';

test.describe('recording an answer sheet (M5)', () => {
  test('recorded offline, kept on the phone, sent with the learner’s session when back online', async ({
    page,
    context
  }) => {
    const posted: { auth: string | null; body: Record<string, unknown> }[] = [];
    let server: Record<string, unknown>[] = [];
    await page.route('**/db/rest/v1/sheet_records*', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        const body = req.postDataJSON() as Record<string, unknown>;
        posted.push({ auth: req.headers()['authorization'] ?? null, body });
        server = [{ ...body, checked_at: null }];
        return route.fulfill({ status: 201, body: '' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(server)
      });
    });

    // A learner signed in on this phone (as /class/ leaves it).
    await page.goto('/class/');
    await page.evaluate(
      async ({ id, token }) => {
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('rfa-learners', 1);
          req.onupgradeneeded = () =>
            req.result.createObjectStore('sessions', { keyPath: 'learnerId' });
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const tx = req.result.transaction('sessions', 'readwrite');
            tx.objectStore('sessions').put({
              learnerId: id,
              nickname: 'Thandi R',
              avatar: 'rocket',
              token,
              expiresAt: Math.floor(Date.now() / 1000) + 86400
            });
            tx.oncomplete = () => resolve();
          };
        });
        sessionStorage.setItem('rfa-learner-now', JSON.stringify({ id, at: Date.now() }));
      },
      { id: LEARNER, token: TOKEN }
    );
    await page.goto('/me/');
    await expect(page.getByRole('heading', { name: /Hello, Thandi R/ })).toBeVisible();

    // An unknown code says so.
    await page.getByLabel(/Sheet code/).fill('p1-crank-01-000000');
    await page.getByRole('button', { name: 'Find the sheet' }).click();
    await expect(page.getByRole('status')).toContainText('don’t know that sheet code');

    await context.setOffline(true);
    await page.getByLabel(/Sheet code/).fill(' P1-CRANK-01-81FEED ');
    await page.getByRole('button', { name: 'Find the sheet' }).click();
    await expect(page.getByText('Tick what your paper sheet shows.')).toBeVisible();
    const boxes = page.locator('fieldset input[type="checkbox"]');
    const count = await boxes.count();
    for (let i = 0; i < 3; i++) await boxes.nth(i).check();
    const yes = page.getByRole('radio', { name: 'Yes' });
    const notYet = page.getByRole('radio', { name: 'Not yet' });
    const checks = await yes.count();
    // Saving without every "I can" answered is refused.
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText('every “I can”');
    for (let i = 0; i < checks; i++) await (i === 0 ? notYet.nth(i) : yes.nth(i)).check();
    await page.getByLabel(/Built and working/).check();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText('Saved on this phone');
    await expect(page.getByText('⏳ saved on this phone')).toBeVisible();
    expect(posted).toEqual([]);

    // Back online: sent with this learner's own session.
    await context.setOffline(false);
    await expect(page.getByText('✓ sent')).toBeVisible();
    expect(posted).toHaveLength(1);
    expect(posted[0]?.auth).toBe(`Bearer ${TOKEN}`);
    expect(posted[0]?.body).toMatchObject({
      learner_id: LEARNER,
      lesson_id: 'p1-crank-01',
      sheet_code: 'p1-crank-01-81feed',
      steps_done: 3,
      built_working: true,
      team_sheet: false
    });
    const icans = posted[0]?.body['i_can'] as boolean[];
    expect(icans).toHaveLength(checks);
    expect(icans[0]).toBe(false);
    expect(String(posted[0]?.body['id'])).toMatch(/^[0-9a-f]{64}$/);
    expect(count).toBeGreaterThan(3);
    // No free text is ever recorded (FR-B4).
    expect(Object.keys(posted[0]?.body ?? {}).sort()).toEqual(
      [
        'built_working',
        'i_can',
        'id',
        'learner_id',
        'lesson_id',
        'recorded_at',
        'sheet_code',
        'steps_done',
        'team_sheet'
      ].sort()
    );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);
  });

  test('every current answer sheet code is in the registry of codes (so old sheets still work)', async ({
    request
  }) => {
    const built = (await (await request.get('/sheets.json')).json()) as { current: string[] };
    const { readFileSync } = await import('node:fs');
    const registry = JSON.parse(readFileSync('content/sheets/codes.json', 'utf8')) as Record<
      string,
      unknown
    >;
    const missing = built.current.filter((c) => !(c in registry));
    expect(
      missing,
      'run `npm run build && npm run sheet-codes`, then commit content/sheets/codes.json'
    ).toEqual([]);
  });
});

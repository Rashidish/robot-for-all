// Learner sign-in on a shared phone (M5 step 5a, ADR-0013). /signin/ is faked here.
import { expect, test } from './fixtures';

const LEARNER = '11111111-1111-4111-8111-111111111111';
const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body)
});

test.describe('learner sign-in (M5)', () => {
  test('first time: class code, name, choose secret pictures; then “who’s using this phone?”', async ({
    page
  }) => {
    let pinSet: number[] | null = null;
    const sent: Record<string, unknown>[] = [];
    await page.route('**/signin/roster', (route) =>
      route.fulfill(
        json({ learners: [{ learner_id: LEARNER, nickname: 'Thandi R', avatar: 'rocket' }] })
      )
    );
    await page.route('**/signin/pin', async (route) => {
      const body = route.request().postDataJSON() as { pin: number[]; choose?: boolean };
      sent.push(body);
      if (!pinSet && !body.choose) return route.fulfill(json({ message: 'choose a pin' }, 409));
      if (body.choose) pinSet = body.pin;
      if (body.pin.join() !== pinSet?.join())
        return route.fulfill(json({ message: 'wrong pin' }, 401));
      return route.fulfill(
        json({
          token: 'header.payload.sig',
          expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
          learner: { id: LEARNER, nickname: 'Thandi R', avatar: 'rocket' }
        })
      );
    });

    await page.goto('/class/');
    await expect(page.locator('h1')).toHaveText('Sign in to your class');
    await page.getByLabel(/Class code/).fill('bcd fgh');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: /Thandi R/ }).click();

    const tapAll = async (names: string[]) => {
      for (const n of names) await page.getByRole('button', { name: n, exact: true }).click();
    };
    // First try: no PIN yet, so the learner chooses one and repeats it.
    await tapAll(['Sun', 'Moon', 'Star', 'Tree']);
    await expect(page.getByRole('status')).toContainText('First time here');
    await tapAll(['Cat', 'Fish', 'Cat', 'Apple']);
    await expect(page.getByRole('status')).toContainText('same 4 pictures');
    await tapAll(['Cat', 'Fish', 'Cat', 'Apple']);

    await expect(page).toHaveURL(/\/me\/$/);
    await expect(page.getByRole('heading', { name: /Hello, Thandi R/ })).toBeVisible();
    expect(sent.at(-1)).toEqual({
      class_code: 'BCDFGH',
      learner: LEARNER,
      pin: [5, 4, 5, 8],
      choose: true
    });
    // The session is in IndexedDB, never in localStorage or cookies.
    expect(await page.evaluate(() => JSON.stringify(localStorage) + document.cookie)).not.toContain(
      'header.payload.sig'
    );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 360);
    expect(overflow).toBe(false);

    // Done: next time this phone offers Thandi without the PIN.
    await page.getByRole('button', { name: 'I’m done' }).click();
    await expect(page.getByRole('heading', { name: 'Who’s using this phone?' })).toBeVisible();
    await page.getByRole('button', { name: /Thandi R/ }).click();
    await expect(page.getByRole('heading', { name: /Hello, Thandi R/ })).toBeVisible();

    // Removed from the phone: gone from the list.
    await page.getByRole('button', { name: 'Remove me from this phone' }).click();
    await expect(page.getByLabel(/Class code/)).toBeVisible();
  });

  test('a wrong PIN says so; too many tries says to wait', async ({ page }) => {
    let tries = 0;
    await page.route('**/signin/roster', (route) =>
      route.fulfill(
        json({ learners: [{ learner_id: LEARNER, nickname: 'Thandi R', avatar: 'rocket' }] })
      )
    );
    await page.route('**/signin/pin', (route) =>
      route.fulfill(
        tries++ < 1 ? json({ message: 'wrong pin' }, 401) : json({ message: 'locked' }, 423)
      )
    );
    await page.goto('/class/');
    await page.getByLabel(/Class code/).fill('BCDFGH');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: /Thandi R/ }).click();
    for (const k of ['1', '2', '3', '4']) await page.keyboard.press(k);
    await expect(page.getByRole('status')).toHaveText('Not quite. Try again.');
    for (const k of ['1', '2', '3', '4']) await page.keyboard.press(k);
    await expect(page.getByText(/Too many tries/)).toBeVisible();
  });

  test('a wrong class code says so', async ({ page }) => {
    await page.goto('/class/');
    await page.getByLabel(/Class code/).fill('AEIOU1');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('status')).toContainText('didn’t work');
  });
});

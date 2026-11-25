import { describe, expect, it } from 'vitest';
import { AccountError, accountClient, type Deps } from './client';

function fakeDeps(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const store = new Map<string, string>();
  let now = 1_000_000_000_000;
  const deps: Deps = {
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const key = Object.keys(replies).find((k) => url.startsWith(k));
      const r = key ? replies[key] : undefined;
      if (!r) return new Response('{}', { status: 404 });
      return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
    }) as unknown as typeof fetch,
    storage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k)
    },
    now: () => now
  };
  return { deps, calls, store, tick: (ms: number) => (now += ms) };
}

const tokens = (access: string) => ({
  access_token: access,
  refresh_token: `refresh-${access}`,
  expires_in: 3600,
  user: { id: 'user-1' }
});

describe('account client', () => {
  it('signs in with an emailed code, through /db/ only', async () => {
    const f = fakeDeps({
      '/db/auth/v1/otp': { body: {} },
      '/db/auth/v1/verify': { body: tokens('a1') }
    });
    const c = accountClient(f.deps);
    await c.requestCode(' teacher@example.org ');
    const s = await c.verifyCode('teacher@example.org', '123 456');
    expect(s.userId).toBe('user-1');
    expect(JSON.parse(String(f.calls[1]?.init.body))).toEqual({
      type: 'email',
      email: 'teacher@example.org',
      token: '123456'
    });
    expect(f.calls.every((x) => x.url.startsWith('/db/'))).toBe(true);
    // Remembered on this device.
    expect(await accountClient(f.deps).session()).toMatchObject({ userId: 'user-1' });
  });

  it('refreshes an expiring session, and signs out on a refused refresh', async () => {
    const f = fakeDeps({
      '/db/auth/v1/verify': { body: tokens('a1') },
      '/db/auth/v1/token': { body: tokens('a2') }
    });
    const c = accountClient(f.deps);
    await c.verifyCode('p@example.org', '111111');
    f.tick(3600 * 1000);
    expect((await c.session())?.accessToken).toBe('a2');
    const g = fakeDeps({
      '/db/auth/v1/verify': { body: tokens('a1') },
      '/db/auth/v1/token': { status: 400, body: { msg: 'bad' } }
    });
    const d = accountClient(g.deps);
    await d.verifyCode('p@example.org', '111111');
    g.tick(3600 * 1000);
    expect(await d.session()).toBeNull();
    expect(g.store.size).toBe(0);
  });

  it('calls database functions with the session; explains errors', async () => {
    const f = fakeDeps({
      '/db/auth/v1/verify': { body: tokens('a1') },
      '/db/rest/v1/rpc/create_class': {
        status: 400,
        body: { message: 'only staff of this school or club can make a class' }
      }
    });
    const c = accountClient(f.deps);
    await expect(c.rpc('touch_adult')).rejects.toThrow(/sign in again/);
    await c.verifyCode('t@example.org', '222222');
    await expect(c.rpc('create_class', { p_org: 'x' })).rejects.toThrow(AccountError);
    const last = f.calls.at(-1);
    expect(new Headers(last?.init.headers).get('authorization')).toBe('Bearer a1');
  });

  it('calls the certificate service at /cert/ with the session, and keeps nothing it returns', async () => {
    const f = fakeDeps({
      '/db/auth/v1/verify': { body: tokens('a1') },
      '/cert/show-names': { body: { names: [{ learner: 'l1', name: 'Thandiwe Radebe' }] } }
    });
    const c = accountClient(f.deps);
    await c.verifyCode('t@example.org', '222222');
    const r = await c.cert<{ names: unknown[] }>('show-names', { class: 'c1' });
    expect(r.names).toHaveLength(1);
    const last = f.calls.at(-1);
    expect(last?.url).toBe('/cert/show-names');
    expect(new Headers(last?.init.headers).get('authorization')).toBe('Bearer a1');
    expect([...f.store.values()].join()).not.toContain('Thandiwe');
  });
});

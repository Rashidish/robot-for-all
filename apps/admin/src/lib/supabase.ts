// Supabase on the server, as the signed-in person (ADR-0010, ADR-0011). The session lives in
// httpOnly, Secure, SameSite cookies: page scripts can never read it.
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from 'astro:env/server';

export function serverClient(request: Request, cookies: AstroCookies) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '').map((c) => ({
          name: c.name,
          value: c.value ?? ''
        }));
      },
      setAll(list) {
        for (const { name, value, options } of list) {
          cookies.set(name, value, {
            ...options,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'lax'
          });
        }
      }
    }
  });
}

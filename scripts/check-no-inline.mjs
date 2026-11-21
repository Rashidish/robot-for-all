// Fails if any built page has inline <script>, <style> or style="" — the CSP in _headers
// (script-src 'self'; style-src 'self') would block them on the live site.
// Usage: node scripts/check-no-inline.mjs apps/web/dist
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? 'apps/web/dist';
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : [f];
  });

const problems = [];
for (const file of walk(root).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (!/\bsrc=/.test(m[1])) problems.push(`${file}: inline <script>`);
  }
  if (/<style\b/i.test(html)) problems.push(`${file}: inline <style>`);
  if (/\sstyle=["']/i.test(html)) problems.push(`${file}: style="" attribute`);
  if (/\son[a-z]+=["']/i.test(html)) problems.push(`${file}: inline event handler`);
}
if (problems.length) {
  console.error(`Inline code found (blocked by our CSP):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('No inline scripts or styles: the strict CSP will not block anything.');

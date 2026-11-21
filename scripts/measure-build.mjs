// Measures what a phone downloads for one page of a static build.
// Usage: node scripts/measure-build.mjs <buildDir> <pagePath> <label>
// Follows the page's <script src>, <link href> (stylesheet/modulepreload) and static JS imports.
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const [buildDir, pagePath, label] = process.argv.slice(2);
const root = resolve(buildDir);
const pageFile = join(root, pagePath, 'index.html');
const seen = new Map();

function add(file) {
  if (seen.has(file) || !existsSync(file)) return;
  const buf = readFileSync(file);
  seen.set(file, buf);
  if (file.endsWith('.js')) {
    const src = buf.toString('utf8');
    for (const m of src.matchAll(/(?:import|from)\s*["']([^"']+\.js)["']/g)) {
      const spec = m[1];
      add(spec.startsWith('/') ? join(root, spec) : resolve(dirname(file), spec));
    }
  }
}

const html = readFileSync(pageFile, 'utf8');
seen.set(pageFile, Buffer.from(html));
for (const m of html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)=["']([^"']+)["'][^>]*>/g)) {
  const ref = m[1];
  if (/^https?:/.test(ref)) { console.error(`THIRD-PARTY REQUEST: ${ref}`); process.exitCode = 1; continue; }
  if (!/\.(js|css)$/.test(ref)) continue;
  add(ref.startsWith('/') ? join(root, ref) : resolve(dirname(pageFile), ref));
}
// Inline dynamic imports in HTML (SvelteKit boots with import("/_app/...") inside a <script>)
for (const m of html.matchAll(/import\(["']([^"']+\.js)["']\)/g)) {
  const ref = m[1];
  add(ref.startsWith('/') ? join(root, ref) : resolve(dirname(pageFile), ref));
}

const rows = { html: [0, 0, 0], js: [0, 0, 0], css: [0, 0, 0] };
for (const [file, buf] of seen) {
  const kind = file.endsWith('.js') ? 'js' : file.endsWith('.css') ? 'css' : 'html';
  rows[kind][0] += buf.length;
  rows[kind][1] += gzipSync(buf, { level: 9 }).length;
  rows[kind][2] += brotliCompressSync(buf).length;
}
const total = [0, 1, 2].map((i) => rows.html[i] + rows.js[i] + rows.css[i]);
const kb = (n) => (n / 1024).toFixed(1);

let md = `### ${label}: \`${pagePath}\`\n\n| | Files | Raw KB | Gzip KB | Brotli KB |\n|---|---|---|---|---|\n`;
for (const k of ['html', 'js', 'css']) {
  const n = [...seen.keys()].filter((f) => (k === 'html' ? f.endsWith('.html') : f.endsWith(`.${k}`))).length;
  md += `| ${k.toUpperCase()} | ${n} | ${kb(rows[k][0])} | ${kb(rows[k][1])} | ${kb(rows[k][2])} |\n`;
}
md += `| **Total** | ${seen.size} | ${kb(total[0])} | **${kb(total[1])}** | ${kb(total[2])} |\n\n`;
console.log(md);
console.log(JSON.stringify({ label, page: pagePath, gzipBytes: total[1], brotliBytes: total[2], jsGzipBytes: rows.js[1] }));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);

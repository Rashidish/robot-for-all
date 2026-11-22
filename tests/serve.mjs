// Serves apps/web/dist like Cloudflare Pages does, including the headers from _headers,
// so browser tests also catch Content-Security-Policy problems.
// Usage: node tests/serve.mjs [port]
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = new URL('../apps/web/dist/', import.meta.url).pathname;
const port = Number(process.argv[2] ?? 4321);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json'
};

// Parse _headers: "path" lines followed by indented "Name: value" lines.
const rules = [];
for (const line of readFileSync(join(root, '_headers'), 'utf8').split('\n')) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: {} });
  else if (line.trim().startsWith('!')) {
    // "! Name" removes a header set by an earlier rule (Cloudflare Pages syntax).
    rules.at(-1).headers[line.trim().slice(1).trim()] = null;
  } else {
    const i = line.indexOf(':');
    rules.at(-1).headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}
const matches = (pattern, path) =>
  pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern;

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(root, path));
  if (!file.startsWith(root)) file = join(root, '404.html');
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  let status = 200;
  if (!existsSync(file)) {
    // Like Cloudflare Pages: "/about" → "/about/", otherwise the 404 page.
    if (existsSync(join(root, path, 'index.html'))) {
      res.writeHead(308, { Location: `${path}/` }).end();
      return;
    }
    file = join(root, '404.html');
    status = 404;
  }
  for (const rule of rules) {
    if (matches(rule.pattern, path)) {
      for (const [name, value] of Object.entries(rule.headers)) {
        if (value === null) res.removeHeader(name);
        else res.setHeader(name, value);
      }
    }
  }
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
  res.writeHead(status).end(readFileSync(file));
}).listen(port, () => console.log(`Serving apps/web/dist on http://localhost:${port}`));

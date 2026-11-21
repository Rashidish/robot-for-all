// Astro integration: after the build, writes dist/sw.js with a content-hash version and
// the exact list of shell files to keep offline.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { precacheList, renderServiceWorker } from './precache';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

export function serviceWorker(): AstroIntegration {
  let projectRoot: URL;
  return {
    name: 'robot-for-all:service-worker',
    hooks: {
      'astro:config:done': ({ config }) => {
        projectRoot = config.root;
      },
      'astro:build:done': ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = walk(root).map((f) => relative(root, f).split(sep).join('/'));
        const urls = precacheList(files);

        const hash = createHash('sha256');
        for (const url of urls) {
          const file = url.endsWith('/') ? `${url.slice(1)}index.html` : url.slice(1);
          hash.update(url);
          hash.update(readFileSync(join(root, file)));
        }
        const version = hash.digest('hex').slice(0, 12);

        const template = readFileSync(new URL('src/sw/sw-template.js', projectRoot), 'utf8');
        writeFileSync(join(root, 'sw.js'), renderServiceWorker(template, version, urls));
        logger.info(`sw.js written: version ${version}, ${urls.length} files kept offline`);
      }
    }
  };
}

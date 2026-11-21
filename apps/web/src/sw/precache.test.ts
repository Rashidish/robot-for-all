import { describe, expect, it } from 'vitest';
import template from './sw-template.js?raw';
import { precacheList, renderServiceWorker, SHELL_PAGES } from './precache';

describe('precache list', () => {
  const files = [
    'index.html',
    'about/index.html',
    'lessons/index.html',
    'lessons/p1-crank-01/index.html',
    'offline/index.html',
    '_astro/app.abc123.css',
    'icons/icon-192.png',
    'favicon.svg',
    'manifest.webmanifest',
    'sw.js',
    '404.html'
  ];
  const list = precacheList(files);

  it('includes the shell pages and build assets', () => {
    for (const page of SHELL_PAGES) expect(list).toContain(page);
    expect(list).toContain('/_astro/app.abc123.css');
    expect(list).toContain('/icons/icon-192.png');
    expect(list).toContain('/manifest.webmanifest');
  });

  it('leaves out lesson pages (cached on visit or download) and the worker itself', () => {
    expect(list).not.toContain('/lessons/p1-crank-01/');
    expect(list).not.toContain('/sw.js');
  });
});

describe('service worker', () => {
  it('fills in the version and file list, producing valid JavaScript', () => {
    const sw = renderServiceWorker(template, 'v123', ['/', '/offline/']);
    expect(sw).toContain('const VERSION = "v123"');
    expect(sw).toContain('const PRECACHE = ["/","/offline/"]');
    expect(() => new Function(sw)).not.toThrow();
  });

  it('only handles same-origin GET requests', () => {
    expect(template).toContain("request.method !== 'GET'");
    expect(template).toContain('url.origin !== self.location.origin');
  });
});

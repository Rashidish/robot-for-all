import { describe, expect, it } from 'vitest';
import template from '../sw/sw-template.js?raw';
import { lessonUrls, PAGES_CACHE } from './offline';

const origin = 'https://learn.example.org';
const page = '/lessons/p1-crank-01/';

describe('lesson download list', () => {
  it('starts with the lesson page', () => {
    expect(lessonUrls(page, [], origin)).toEqual([page]);
  });

  it('includes same-origin styles, scripts, images and templates, without duplicates', () => {
    const urls = lessonUrls(
      page,
      [
        '/_astro/app.css',
        '/_astro/app.css',
        'images/rhino.webp',
        `${origin}/templates/rhino-body.svg`
      ],
      origin
    );
    expect(urls).toEqual([
      page,
      '/_astro/app.css',
      '/lessons/p1-crank-01/images/rhino.webp',
      '/templates/rhino-body.svg'
    ]);
  });

  it('never includes other sites or non-web links', () => {
    const urls = lessonUrls(
      page,
      ['https://cdn.example.com/x.js', 'data:image/png;base64,AAAA', 'javascript:alert(1)', ''],
      origin
    );
    expect(urls).toEqual([page]);
  });

  it('uses the same cache name as the service worker', () => {
    expect(template).toContain(`const PAGES_CACHE = '${PAGES_CACHE}'`);
  });
});

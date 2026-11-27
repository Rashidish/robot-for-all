import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bannerId, bannerText, buildSettings, checkSettings, FEATURES } from './site';

const file = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../content/site/settings.json'), 'utf8')
) as unknown;
const on = Object.fromEntries(FEATURES.map((f) => [f, true]));
const banner = {
  from: '2027-01-06',
  to: '2027-01-13',
  text: { en: 'Season 1 starts on 13 January!' }
};

describe('site settings (back-office spec §6.7)', () => {
  it('the settings file in the repository is valid', () => {
    expect(checkSettings(file)).toEqual([]);
    // Everything on, except accounts (M5) and the AI helper (M6), off until the owner opens them.
    expect(buildSettings(file).features).toEqual({ ...on, accounts: false, ai_helper: false });
  });

  it('accepts a banner with a link to a page on this site', () => {
    expect(checkSettings({ announcement: { ...banner, link: '/code/' }, features: on })).toEqual(
      []
    );
  });

  it.each([
    ['an unknown setting', { announcement: null, features: on, colour: 'red' }, '$.colour'],
    [
      'a missing switch',
      { announcement: null, features: { robot_world: true } },
      '$.features.print_course'
    ],
    ['an unknown switch', { announcement: null, features: { ...on, ads: true } }, '$.features.ads'],
    [
      'a switch that is not on/off',
      { announcement: null, features: { ...on, seasons: 'yes' } },
      '$.features.seasons'
    ],
    [
      'no English',
      { announcement: { ...banner, text: {} }, features: on },
      '$.announcement.text.en'
    ],
    [
      'an unknown language',
      { announcement: { ...banner, text: { en: 'Hi', xx: 'Hi' } }, features: on },
      '$.announcement.text.xx'
    ],
    [
      'too many words',
      { announcement: { ...banner, text: { en: 'x'.repeat(161) } }, features: on },
      '$.announcement.text.en'
    ],
    [
      'HTML in the words',
      { announcement: { ...banner, text: { en: 'Hi <b>there</b>' } }, features: on },
      '$.announcement.text.en'
    ],
    [
      'an end before the start',
      { announcement: { ...banner, to: '2027-01-01' }, features: on },
      '$.announcement.to'
    ],
    [
      'a link to another site',
      { announcement: { ...banner, link: 'https://evil.example' }, features: on },
      '$.announcement.link'
    ],
    [
      'a protocol-relative link',
      { announcement: { ...banner, link: '//evil.example/' }, features: on },
      '$.announcement.link'
    ],
    [
      'a javascript: link',
      { announcement: { ...banner, link: 'javascript:alert(1)' }, features: on },
      '$.announcement.link'
    ]
  ])('refuses %s', (_name, spec, path) => {
    expect(checkSettings(spec).map((p) => p.path)).toContain(path);
    expect(() => buildSettings(spec)).toThrow();
  });

  it('falls back to English and gives each banner its own id', () => {
    expect(bannerText(banner, 'zu')).toBe('Season 1 starts on 13 January!');
    expect(bannerId(banner)).toBe(bannerId({ ...banner }));
    expect(bannerId(banner)).not.toBe(bannerId({ ...banner, to: '2027-01-14' }));
  });
});

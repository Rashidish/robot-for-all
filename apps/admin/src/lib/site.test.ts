import { describe, expect, it } from 'vitest';
import { FEATURES } from '../../../../packages/settings/src/site';
import { FEATURE_LABELS, settingsFromForm } from './site';

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const allOn = Object.fromEntries(FEATURES.map((f) => [`feature_${f}`, 'on']));

describe('Configuration → Site', () => {
  it('no banner and every part on except accounts and the helper gives the repository file', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const file = readFileSync(
      join(import.meta.dirname, '../../../../content/site/settings.json'),
      'utf8'
    );
    const repo = Object.fromEntries(
      Object.entries(allOn).filter(([k]) => k !== 'feature_accounts' && k !== 'feature_ai_helper')
    );
    expect(settingsFromForm(form(repo))).toEqual({ text: file, problems: [] });
  });

  it('a banner with dates, words and a link', () => {
    const { text, problems } = settingsFromForm(
      form({
        ...allOn,
        banner: 'on',
        from: '2027-01-06',
        to: '2027-01-13',
        text_en: ' Season 1 starts on 13 January! ',
        link: '/code/'
      })
    );
    expect(problems).toEqual([]);
    expect(JSON.parse(text)).toMatchObject({
      announcement: {
        from: '2027-01-06',
        to: '2027-01-13',
        text: { en: 'Season 1 starts on 13 January!' },
        link: '/code/'
      }
    });
  });

  it('an unticked part is switched off', () => {
    const rest = Object.fromEntries(
      Object.entries(allOn).filter(([k]) => k !== 'feature_print_course')
    );
    const spec = JSON.parse(settingsFromForm(form(rest)).text) as {
      features: Record<string, boolean>;
    };
    expect(spec.features['print_course']).toBe(false);
    expect(spec.features['robot_world']).toBe(true);
  });

  it('refuses a banner without words, or with a link to another site', () => {
    const bad = settingsFromForm(
      form({ ...allOn, banner: 'on', from: '2027-01-06', to: '2027-01-13', text_en: '' })
    );
    expect(bad.problems.map((p) => p.path)).toContain('$.announcement.text.en');
    const away = settingsFromForm(
      form({
        ...allOn,
        banner: 'on',
        from: '2027-01-06',
        to: '2027-01-13',
        text_en: 'Hi',
        link: 'https://evil.example'
      })
    );
    expect(away.problems.map((p) => p.path)).toContain('$.announcement.link');
  });

  it('has an admin label for every switch', () => {
    for (const f of FEATURES) expect(FEATURE_LABELS[f]).toBeTruthy();
  });
});

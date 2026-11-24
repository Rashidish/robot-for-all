import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lessonCoverage, wordCoverage } from './coverage';

const root = join(import.meta.dirname, '../../../../');
const en = JSON.parse(readFileSync(join(root, 'content/i18n/en.json'), 'utf8')) as Record<
  string,
  string
>;

describe('what still needs translating', () => {
  it('groups every interface word into one area, worlds and challenges included', () => {
    const areas = wordCoverage(en, {});
    const total = Object.keys(en).filter((k) => !k.startsWith('$')).length;
    expect(areas.reduce((n, a) => n + a.total, 0)).toBe(total);
    const worlds = areas.find((a) => a.area.startsWith('Robot worlds'));
    expect(worlds?.missing.map((m) => m.key)).toContain('world_rhino_patrol_challenge');
    expect(worlds?.missing.map((m) => m.key)).toContain('mission_rhino_patrol_home');
    expect(worlds?.missing.map((m) => m.key)).toContain('season_rhino_patrol_name');
    expect(
      areas.find((a) => a.area.startsWith('Code editor'))?.missing.map((m) => m.key)
    ).toContain('block_forever');
  });

  it('counts a word as missing when it is absent or blank', () => {
    const [first] = Object.keys(en).filter((k) => !k.startsWith('$'));
    const areas = wordCoverage(en, { [first ?? '']: 'Robots For All', nav_home: '  ' });
    const missing = areas.flatMap((a) => a.missing.map((m) => m.key));
    expect(missing).not.toContain(first);
    expect(missing).toContain('nav_home');
  });

  it('flags live English lessons learners would still see in English', () => {
    const rows = lessonCoverage(
      [
        { id: 'p1-wheel-01', title: 'Cart', status: 'published', hash: 'a' },
        { id: 'p1-crank-01', title: 'Rhino', status: 'published', hash: 'b' },
        { id: 'p1-cam-01', title: 'Box', status: 'published', hash: 'c' },
        { id: 'p1-gear-01', title: 'Gears', status: 'published', hash: 'd' },
        { id: 'p2-art-01', title: 'Pen art', status: 'draft', hash: 'e' }
      ],
      [
        { lesson: 'p1-wheel-01', status: 'published', translatedFrom: 'a' },
        { lesson: 'p1-crank-01', status: 'published', translatedFrom: 'old' },
        { lesson: 'p1-cam-01', status: 'draft', translatedFrom: 'c' }
      ]
    );
    expect(rows.map((r) => [r.id, r.state, r.flagged])).toEqual([
      ['p1-wheel-01', 'published', false],
      ['p1-crank-01', 'needs_updating', true],
      ['p1-cam-01', 'draft', true],
      ['p1-gear-01', 'not_translated', true],
      ['p2-art-01', 'not_translated', false]
    ]);
  });

  it('flags a published translation whose sheets still print in English', () => {
    const [row] = lessonCoverage(
      [
        {
          id: 'p1-crank-01',
          title: 'Rhino',
          status: 'published',
          hash: 'a',
          templates: ['rhino-parts', 'spare']
        }
      ],
      [
        {
          lesson: 'p1-crank-01',
          status: 'published',
          translatedFrom: 'a',
          templates: ['rhino-parts']
        }
      ]
    );
    expect(row).toMatchObject({ state: 'published', englishSheets: ['spare'], flagged: true });
  });
});

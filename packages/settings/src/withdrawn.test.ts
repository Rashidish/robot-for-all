import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildWithdrawn,
  checkWithdrawn,
  isWithdrawn,
  oneItemChanged,
  type WithdrawnItem,
  withdrawnText,
  withItem,
  withoutItem
} from './withdrawn';

const file = readFileSync(
  join(import.meta.dirname, '../../../content/site/withdrawn.json'),
  'utf8'
);
const item: WithdrawnItem = {
  type: 'template',
  id: 'p1-crank-01/rhino-parts',
  reason: 'Wrong fold line on the leg',
  since: '2026-11-24'
};

describe('withdrawn list (more content spec §2.4)', () => {
  it('the file in the repository is valid and formatted', () => {
    expect(checkWithdrawn(JSON.parse(file))).toEqual([]);
    expect(withdrawnText(buildWithdrawn(JSON.parse(file)))).toBe(file);
  });

  it('accepts each type with its id format', () => {
    const items = [
      item,
      { ...item, type: 'lesson', id: 'p2-art-01' },
      { ...item, type: 'world', id: 'rhino-patrol' },
      { ...item, type: 'season', id: 'rhino-patrol' },
      { ...item, type: 'language', id: 'zu' }
    ];
    expect(checkWithdrawn({ items })).toEqual([]);
  });

  it.each([
    ['an unknown type', { ...item, type: 'video' }, '.type'],
    ['a template id without its lesson', { ...item, id: 'rhino-parts' }, '.id'],
    ['a short reason', { ...item, reason: 'bad' }, '.reason'],
    ['HTML in the reason', { ...item, reason: '<b>wrong fold line</b>' }, '.reason'],
    ['a bad date', { ...item, since: 'today' }, '.since'],
    ['an extra field', { ...item, colour: 'red' }, '.colour']
  ])('refuses %s', (_name, bad, path) => {
    expect(
      checkWithdrawn({ items: [bad] })
        .map((p) => p.path)
        .join(' ')
    ).toContain(path);
  });

  it('refuses the same item twice', () => {
    expect(checkWithdrawn({ items: [item, item] })).toHaveLength(1);
  });

  it('a withdrawn lesson takes its templates with it', () => {
    const list = { items: [{ ...item, type: 'lesson' as const, id: 'p1-crank-01' }] };
    expect(isWithdrawn(list, 'lesson', 'p1-crank-01')).toBe(true);
    expect(isWithdrawn(list, 'template', 'p1-crank-01/rhino-parts')).toBe(true);
    expect(isWithdrawn(list, 'template', 'p1-cam-01/cam-parts')).toBe(false);
    expect(isWithdrawn(list, 'world', 'p1-crank-01')).toBe(false);
  });

  it('adds, replaces and removes one item; the merge check sees exactly one change', () => {
    const empty = { items: [] };
    const one = withItem(empty, item);
    expect(one.items).toEqual([item]);
    expect(withItem(one, { ...item, reason: 'A different reason' }).items).toHaveLength(1);
    expect(withoutItem(one, 'template', item.id)).toEqual(empty);
    expect(oneItemChanged(empty, one)).toBe(true);
    expect(oneItemChanged(one, empty)).toBe(true);
    expect(oneItemChanged(empty, empty)).toBe(false);
    const two = withItem(one, { ...item, type: 'world', id: 'bump-maze' });
    expect(oneItemChanged(empty, two)).toBe(false);
    expect(oneItemChanged(one, withItem(empty, { ...item, reason: 'Changed the reason' }))).toBe(
      false
    );
    expect(oneItemChanged(empty, { items: [{ ...item, reason: 'x' }] })).toBe(false);
  });
});

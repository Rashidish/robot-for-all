import { describe, expect, it } from 'vitest';
import en from '../../../../content/i18n/en.json';
import { t, type MessageKey } from './index';

describe('English messages', () => {
  const keys = Object.keys(en) as MessageKey[];

  it('has no empty strings', () => {
    const empty = keys.filter((k) => t(k).trim() === '');
    expect(empty).toEqual([]);
  });

  it('uses dotted lowercase keys', () => {
    const bad = keys.filter((k) => !/^[a-z]+(\.[a-z_]+)+$/.test(k));
    expect(bad).toEqual([]);
  });
});

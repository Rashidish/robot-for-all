import { describe, expect, it } from 'vitest';
import en from '../../../../content/i18n/en.json';
import { m } from './index';

const keys = Object.keys(en).filter((k) => !k.startsWith('$'));

describe('English messages', () => {
  it('has no empty strings', () => {
    const empty = keys.filter((k) => String(en[k as keyof typeof en]).trim() === '');
    expect(empty).toEqual([]);
  });

  it('uses lowercase snake_case keys that are valid identifiers', () => {
    const bad = keys.filter((k) => !/^[a-z]+(_[a-z]+)+$/.test(k));
    expect(bad).toEqual([]);
  });

  it('compiles every key into a message function', () => {
    const messages = m as unknown as Record<string, () => string>;
    const missing = keys.filter((k) => typeof messages[k] !== 'function');
    expect(missing).toEqual([]);
    expect(m.app_name()).toBe('Robots For All');
  });
});

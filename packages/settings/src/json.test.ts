import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prettyJson } from './json';

const root = join(import.meta.dirname, '../../..');
const files = [
  'project.inlang/settings.json',
  'content/i18n/languages.json',
  'content/site/settings.json',
  'content/site/withdrawn.json',
  ...readdirSync(join(root, 'content/seasons'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => `content/seasons/${f}`)
];

describe('JSON written like the repository formatter', () => {
  it.each(files)('%s comes out byte-for-byte the same', (f) => {
    const text = readFileSync(join(root, f), 'utf8');
    expect(prettyJson(JSON.parse(text))).toBe(text);
  });

  it('puts short lists of plain values on one line, long ones one per line', () => {
    expect(prettyJson({ locales: ['en', 'zu'] })).toBe('{\n  "locales": ["en", "zu"]\n}\n');
    const long = Array.from({ length: 30 }, (_, i) => `item-${i}`);
    expect(prettyJson({ a: long }).split('\n').length).toBeGreaterThan(30);
    expect(prettyJson({ a: [], b: {} })).toBe('{\n  "a": [],\n  "b": {}\n}\n');
  });
});

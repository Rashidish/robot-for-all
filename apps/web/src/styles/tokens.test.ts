// Checks every text/background pair in tokens.css meets WCAG 2.2 AA (4.5:1), in light and dark mode.
import { describe, expect, it } from 'vitest';
import css from './tokens.css?raw';

function colours(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)) {
    out[m[1] as string] = m[2] as string;
  }
  return out;
}

const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const light = colours(css.slice(0, darkStart));
const dark = { ...light, ...colours(css.slice(darkStart)) };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const pairs: [fg: string, bg: string, min: number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'surface', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'surface', 4.5],
  ['on-accent', 'accent', 4.5],
  ['focus', 'bg', 3] // focus indicators need 3:1 (WCAG 2.4.13 / 1.4.11)
];

describe.each([
  ['light', light],
  ['dark', dark]
])('%s mode colours', (_mode, palette) => {
  it.each(pairs)('%s on %s meets %s:1', (fg, bg, min) => {
    const a = palette[fg];
    const b = palette[bg];
    expect(a, `--color-${fg} missing`).toBeDefined();
    expect(b, `--color-${bg} missing`).toBeDefined();
    expect(contrast(a as string, b as string)).toBeGreaterThanOrEqual(min);
  });
});

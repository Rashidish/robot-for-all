// Lesson diagrams carry no words (translate-templates-and-programs spec §2.5): only numbered
// callouts, explained in the lesson text (which is translated), and markings printed on real
// parts, which are the same in every language.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const lessons = join(import.meta.dirname, '../../../../content/lessons');

/** Markings allowed in a diagram: numbers, pins, board and part names, voltages, signs. */
const ALLOWED = [
  /^\d+$/, // callouts and counts
  /^P\d{1,2}$/, // micro:bit pins
  /^(GND|VCC|3V)$/,
  /^[AB](-I[AB])?$/, // motor driver terminals A, B, A-IA …
  /^(L9110S|SG90|micro:bit)$/, // names printed on the parts
  /^\d+(\.\d+)? ?(V|mm|cm)$/, // 3 V, 50 mm
  /^\d+ ?× ?AA$/, // battery packs
  /^[+−×]$/
];

function diagramWords(svg: string): string[] {
  return [...svg.matchAll(/<text\b[^>]*>([^<]*)</g)]
    .map((m) => (m[1] ?? '').trim())
    .filter((t) => t !== '' && !ALLOWED.some((re) => re.test(t)));
}

const files = readdirSync(lessons).flatMap((lesson) => {
  try {
    return readdirSync(join(lessons, lesson, 'images'))
      .filter((f) => f.endsWith('.svg'))
      .map((f) => join(lesson, 'images', f));
  } catch {
    return [];
  }
});

describe('lesson diagrams carry no words, only callouts and printed markings', () => {
  it('finds diagrams to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)('%s', (file) => {
    expect(diagramWords(readFileSync(join(lessons, file), 'utf8'))).toEqual([]);
  });

  it('catches a word', () => {
    expect(
      diagramWords(
        '<text x="1">P0</text><text>MOTOR DRIVER</text><text>3 V</text><text>finish</text>'
      )
    ).toEqual(['MOTOR DRIVER', 'finish']);
  });
});

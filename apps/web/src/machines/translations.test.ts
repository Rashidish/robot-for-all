// Topic translations (machines spec FR-10): words line up with the English topic.
import { describe, expect, it } from 'vitest';
import { machineTranslationProblems, machineTranslationSchema } from './schema';

const english = {
  stand_ins: [
    { item: 'a short piece of drinking straw', note: 'about 2 cm' },
    { item: 'a pen tube' }
  ],
  safety: { adult_help: true, notes: ['An adult cuts the straw', 'Make holes into Prestik'] }
};
const body = '## How it works\n\n1. x\n\n## Try it\n\n1. y\n';
const t = {
  title: 'Ibhushi',
  card: 'Ibhushi iyishubhu elibushelelezi i-ekseli ezungeza ngaphakathi kwalo.',
  picture_alt: 'I-ekseli (1) emshubhwini (2)',
  stand_ins: [{ item: 'utshani', note: 'cishe u-2 cm' }, { item: 'ishubhu lepeni' }],
  real_part: 'ibhushi lethusi',
  safety_notes: ['Umuntu omdala usika', 'Bhoboza ePrestik'],
  translated_from: '59ae4df06d73245d',
  status: 'draft',
  ai_generated: true,
  reviewed_by: null
};

describe('topic translations', () => {
  it('accepts words that line up with the English topic', () => {
    const parsed = machineTranslationSchema.parse(t);
    expect(machineTranslationProblems(english, body, parsed, body)).toEqual([]);
  });

  it('rejects facts in a translation, a long card and a published one without a reviewer', () => {
    expect(machineTranslationSchema.safeParse({ ...t, grades: [4] }).success).toBe(false);
    expect(machineTranslationSchema.safeParse({ ...t, card: 'word '.repeat(41) }).success).toBe(
      false
    );
    expect(machineTranslationSchema.safeParse({ ...t, status: 'published' }).success).toBe(false);
  });

  it("reports stand-ins, notes, safety notes and sections that don't line up", () => {
    const parsed = machineTranslationSchema.parse({
      ...t,
      stand_ins: [{ item: 'utshani' }, { item: 'ishubhu', note: 'x2' }, { item: 'okunye' }],
      safety_notes: ['kunye']
    });
    expect(machineTranslationProblems(english, body, parsed, '## Isebenza\n')).toEqual([
      'stand_ins: the English topic has 2, this has 3',
      'stand_ins[0]: has a note only if the English stand-in has one',
      'stand_ins[1]: has a note only if the English stand-in has one',
      'safety_notes: the English topic has 2, this has 1',
      'the body has 1 "##" sections; the English topic has 2 (same order)'
    ]);
  });
});

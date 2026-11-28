import { describe, expect, it } from 'vitest';
import { lessonSchema } from '../lessons/schema';
import { checkSections, linkProblems, machineSchema, usedIn, wordCount } from './schema';

const valid = {
  id: 'bushing',
  title: 'Bushing',
  family: 'wheels-bearings',
  grades: [4, 5, 6],
  card: 'A smooth sleeve an axle spins inside.',
  picture_alt: 'A skewer in a straw in a card frame',
  stand_ins: [{ item: 'drinking straw', note: 'about 2 cm' }],
  real_part: 'a bronze bushing',
  safety: { adult_help: true, notes: ['An adult cuts the skewer point off'] },
  status: 'draft',
  ai_generated: true,
  reviewed_by: null
};

const topic = (id: string, learn_first: string[] = [], lessons: string[] = []) => ({
  id,
  learn_first,
  related: [],
  lessons
});

describe('Machines topic front matter', () => {
  it('accepts a valid draft and fills the defaults', () => {
    const parsed = machineSchema.parse(valid);
    expect(parsed.lessons).toEqual([]);
    expect(parsed.learn_first).toEqual([]);
  });

  it('keeps cards short enough for a phone (FR-3)', () => {
    expect(wordCount('  one two\nthree ')).toBe(3);
    const long = Array.from({ length: 41 }, () => 'word').join(' ');
    expect(machineSchema.safeParse({ ...valid, card: long }).success).toBe(false);
  });

  it('needs a reviewer to publish', () => {
    expect(machineSchema.safeParse({ ...valid, status: 'published' }).success).toBe(false);
    expect(
      machineSchema.safeParse({ ...valid, status: 'published', reviewed_by: 'A Reviewer' }).success
    ).toBe(true);
  });

  it('rejects an unknown family, a bad id and a link to itself', () => {
    expect(machineSchema.safeParse({ ...valid, family: 'magic' }).success).toBe(false);
    expect(machineSchema.safeParse({ ...valid, id: 'Bushing 2' }).success).toBe(false);
    expect(machineSchema.safeParse({ ...valid, learn_first: ['bushing'] }).success).toBe(false);
  });

  it('needs at least one stand-in and one safety note', () => {
    expect(machineSchema.safeParse({ ...valid, stand_ins: [] }).success).toBe(false);
    expect(
      machineSchema.safeParse({ ...valid, safety: { adult_help: false, notes: [] } }).success
    ).toBe(false);
  });
});

describe('Machines topic body', () => {
  it('needs "How it works" then "Try it"', () => {
    expect(checkSections('## How it works\nx\n## Try it\ny\n')).toEqual([]);
    expect(checkSections('## Try it\ny\n## How it works\nx\n')).toHaveLength(1);
    expect(checkSections('## How it works\nx\n')).toHaveLength(1);
  });
});

describe('links between topics and lessons', () => {
  it('passes when every link exists', () => {
    expect(
      linkProblems(
        [topic('crank', ['bushing'], ['p1-crank-01']), topic('bushing')],
        new Set(['p1-crank-01'])
      )
    ).toEqual([]);
  });

  it('finds a missing topic and a missing lesson', () => {
    expect(linkProblems([topic('crank', ['axle'], ['p1-nope-01'])], new Set())).toHaveLength(2);
  });

  it('finds "learn first" going round in a circle (FR-8)', () => {
    const problems = linkProblems(
      [topic('a', ['b']), topic('b', ['c']), topic('c', ['a'])],
      new Set()
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('circle');
  });
});

describe('"Used in" (FR-7)', () => {
  it('lists the lessons that use a topic, worked out from the lessons', () => {
    const lessons = [
      { id: 'p1-crank-01', machines: ['crank', 'bushing'] },
      { id: 'p1-gear-01', machines: ['gear-train', 'bushing'] },
      { id: 'p1-lever-01', machines: [] }
    ];
    expect(usedIn('bushing', lessons).map((l) => l.id)).toEqual(['p1-crank-01', 'p1-gear-01']);
    expect(usedIn('lever', lessons)).toEqual([]);
  });

  it('lessons name topics with valid ids (FR-5)', () => {
    const lesson = {
      id: 'p1-crank-01',
      title: 'Crank-powered waving rhino',
      phase: 1,
      grades: [3],
      mechanism: 'crank',
      duration_minutes: 45,
      cost_estimate_zar: 5,
      parts: [{ item: 'cardboard', qty: 1 }],
      outcomes: ['Explain a crank', 'Build a crank'],
      safety: { adult_help: false, notes: ['Use safety scissors'] },
      assessment: ['I can a', 'I can b', 'I can c'],
      status: 'draft',
      ai_generated: true,
      reviewed_by: null
    };
    expect(lessonSchema.parse(lesson).machines).toEqual([]);
    expect(lessonSchema.safeParse({ ...lesson, machines: ['crank'] }).success).toBe(true);
    expect(lessonSchema.safeParse({ ...lesson, machines: ['Crank!'] }).success).toBe(false);
  });
});

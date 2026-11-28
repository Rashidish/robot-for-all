// Machines: one topic per part or mechanism (spec docs/specs/machines.md). Used by the content
// collection at build time and by unit tests. Topics follow the lesson rules where they can.
import { z } from 'astro/zod';

/** Topic families, in the order the Machine library shows them. */
export const MACHINE_FAMILIES = [
  'gears',
  'levers',
  'linkages',
  'cams-cranks',
  'pulleys',
  'wheels-bearings',
  'springs-dampers',
  'fasteners'
] as const;

export type MachineFamily = (typeof MACHINE_FAMILIES)[number];

/** The most words a card may have: it opens inside a lesson on a small phone (FR-3). */
export const CARD_MAX_WORDS = 40;

/** The body's `##` sections, in order (FR-2). Stand-ins come from the front matter. */
export const MACHINE_SECTIONS = ['How it works', 'Try it'] as const;

export const machineId = z
  .string()
  .regex(/^[a-z]+(-[a-z]+)*$/, 'machine ids are lower-case words joined by "-", like gear-train');

const lessonId = z.string().regex(/^p[1-3]-[a-z]+-\d{2}$/, 'lesson ids look like p1-crank-01');

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

export const machineSchema = z
  .object({
    id: machineId,
    title: z.string().min(3).max(60),
    family: z.enum(MACHINE_FAMILIES),
    grades: z.array(z.number().int().min(1).max(12)).min(1),
    /** The short card shown inside lessons: at most CARD_MAX_WORDS words. */
    card: z
      .string()
      .min(10)
      .refine((t) => wordCount(t) <= CARD_MAX_WORDS, {
        message: `a card has at most ${CARD_MAX_WORDS} words`
      }),
    /** Alt text for picture.svg in the topic folder (a picture without words). */
    picture_alt: z.string().min(5).max(200),
    /** Free or cheap things that work instead of the real part. */
    stand_ins: z
      .array(z.object({ item: z.string().min(2), note: z.string().min(2).optional() }))
      .min(1),
    real_part: z.string().min(2),
    /** Topic lessons, in order: ordinary lessons that teach this topic. */
    lessons: z.array(lessonId).default([]),
    /** Topics worth doing first: suggestions only, never a block (FR-8). */
    learn_first: z.array(machineId).default([]),
    related: z.array(machineId).default([]),
    syllabus_links: z
      .array(z.object({ subject: z.string().min(2), topic: z.string().min(2) }))
      .default([]),
    safety: z.object({
      adult_help: z.boolean(),
      notes: z.array(z.string().min(5)).min(1)
    }),
    status: z.enum(['draft', 'in_review', 'published']),
    ai_generated: z.boolean(),
    reviewed_by: z.string().min(2).nullable()
  })
  .refine((t) => t.status !== 'published' || t.reviewed_by !== null, {
    message: 'A published topic needs reviewed_by (a person must review it first)',
    path: ['reviewed_by']
  })
  .refine((t) => !t.learn_first.includes(t.id) && !t.related.includes(t.id), {
    message: 'A topic cannot link to itself',
    path: ['learn_first']
  });

export type Machine = z.infer<typeof machineSchema>;

/** Problems with the body's `##` sections: MACHINE_SECTIONS, in order, nothing else. */
export function checkSections(body: string): string[] {
  const found = [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1] ?? '');
  const want: readonly string[] = MACHINE_SECTIONS;
  if (found.length === want.length && found.every((h, i) => h === want[i])) return [];
  return [`body sections must be ${want.map((s) => `"## ${s}"`).join(', ')} in order`];
}

/** Problems with links between topics and to lessons. */
export function linkProblems(
  topics: readonly Pick<Machine, 'id' | 'learn_first' | 'related' | 'lessons'>[],
  lessonIds: ReadonlySet<string>
): string[] {
  const ids = new Set(topics.map((t) => t.id));
  const problems: string[] = [];
  for (const t of topics) {
    for (const other of [...t.learn_first, ...t.related]) {
      if (!ids.has(other)) {
        problems.push(`${t.id}: topic "${other}" not found in content/machines/`);
      }
    }
    for (const lesson of t.lessons) {
      if (!lessonIds.has(lesson)) problems.push(`${t.id}: lesson "${lesson}" not found`);
    }
  }
  // "Learn first" must never go round in a circle: a learner could never find where to start.
  const next = new Map(topics.map((t) => [t.id, t.learn_first]));
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      problems.push(`learn_first goes round in a circle: ${[...path, id].join(' → ')}`);
      return;
    }
    state.set(id, 'visiting');
    for (const n of next.get(id) ?? []) visit(n, [...path, id]);
    state.set(id, 'done');
  };
  for (const t of topics) visit(t.id, []);
  return problems;
}

/** Lessons that use a topic ("Used in", FR-7): worked out, never typed by hand. */
export function usedIn<L extends { id: string; machines: readonly string[] }>(
  topic: string,
  lessons: readonly L[]
): L[] {
  return lessons.filter((l) => l.machines.includes(topic));
}

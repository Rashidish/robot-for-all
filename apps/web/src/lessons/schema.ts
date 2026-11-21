// Lesson rules (ADR-0004, CLAUDE.md §6). Used by the content collection at build time and by unit tests.
import { z } from 'astro/zod';

export const PRIMM_STEPS = ['Predict', 'Run', 'Investigate', 'Modify', 'Make'] as const;

export const lessonSchema = z
  .object({
    id: z.string().regex(/^p[1-3]-[a-z]+-\d{2}$/, 'id must look like p1-crank-01'),
    title: z.string().min(3).max(80),
    phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    grades: z.array(z.number().int().min(1).max(12)).min(1),
    mechanism: z.string().min(2),
    syllabus_links: z
      .array(z.object({ subject: z.string().min(2), topic: z.string().min(2) }))
      .default([]),
    duration_minutes: z.number().int().positive().max(240),
    cost_estimate_zar: z.number().nonnegative(),
    parts: z.array(z.object({ item: z.string().min(2), qty: z.number().int().positive() })).min(1),
    templates: z.array(z.string().regex(/\.svg$/, 'templates must be SVG files')).default([]),
    status: z.enum(['draft', 'in_review', 'published']),
    ai_generated: z.boolean(),
    reviewed_by: z.string().min(2).nullable()
  })
  .refine((l) => l.status !== 'published' || l.reviewed_by !== null, {
    message: 'A published lesson needs reviewed_by (a person must review it first)',
    path: ['reviewed_by']
  });

export type Lesson = z.infer<typeof lessonSchema>;

/** Returns problems with the lesson body: the five PRIMM steps must be `##` headings, in order. */
export function checkPrimm(body: string): string[] {
  const headings = [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => (m[1] ?? '').trim());
  const found = headings.filter((h) => (PRIMM_STEPS as readonly string[]).includes(h));
  const problems: string[] = [];
  for (const step of PRIMM_STEPS) {
    if (!found.includes(step)) problems.push(`Missing "## ${step}" heading`);
  }
  if (problems.length === 0 && found.join() !== PRIMM_STEPS.join()) {
    problems.push(`PRIMM headings must be in order: ${PRIMM_STEPS.join(', ')}`);
  }
  return problems;
}

/** Drafts and lessons in review appear only when SHOW_DRAFTS is not "false" (production sets it to "false"). */
export function isVisible(lesson: Pick<Lesson, 'status'>, showDrafts: boolean): boolean {
  return lesson.status === 'published' || showDrafts;
}

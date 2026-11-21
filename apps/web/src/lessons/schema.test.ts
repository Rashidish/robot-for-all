import { describe, expect, it } from 'vitest';
import { checkPrimm, isVisible, lessonSchema } from './schema';

const valid = {
  id: 'p1-crank-01',
  title: 'Crank-powered waving rhino',
  phase: 1,
  grades: [3, 4],
  mechanism: 'crank',
  syllabus_links: [{ subject: 'Natural Sciences and Technology', topic: 'Mechanical systems' }],
  duration_minutes: 45,
  cost_estimate_zar: 15,
  parts: [{ item: 'cardboard', qty: 1 }],
  templates: ['rhino-body.svg'],
  status: 'draft',
  ai_generated: true,
  reviewed_by: null
};

const primmBody = '## Predict\nx\n## Run\nx\n## Investigate\nx\n## Modify\nx\n## Make\nx\n';

describe('lesson front matter', () => {
  it('accepts a valid draft', () => {
    expect(lessonSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a published lesson nobody reviewed', () => {
    const result = lessonSchema.safeParse({ ...valid, status: 'published' });
    expect(result.success).toBe(false);
  });

  it('accepts a published lesson with a reviewer', () => {
    const result = lessonSchema.safeParse({
      ...valid,
      status: 'published',
      reviewed_by: 'T. Mokoena'
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ['bad id', { id: 'rhino' }],
    ['phase 4', { phase: 4 }],
    ['no parts', { parts: [] }],
    ['non-SVG template', { templates: ['rhino.pdf'] }],
    ['unknown status', { status: 'live' }]
  ])('rejects %s', (_name, change) => {
    expect(lessonSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

describe('PRIMM structure', () => {
  it('passes when all five steps are present in order', () => {
    expect(checkPrimm(primmBody)).toEqual([]);
  });

  it('reports a missing step', () => {
    expect(checkPrimm(primmBody.replace('## Modify', '## Change'))).toEqual([
      'Missing "## Modify" heading'
    ]);
  });

  it('reports steps out of order', () => {
    const swapped = '## Run\n## Predict\n## Investigate\n## Modify\n## Make\n';
    expect(checkPrimm(swapped)).toHaveLength(1);
  });
});

describe('draft visibility', () => {
  it('always shows published lessons', () => {
    expect(isVisible({ status: 'published' }, false)).toBe(true);
  });

  it('hides drafts and lessons in review in production', () => {
    expect(isVisible({ status: 'draft' }, false)).toBe(false);
    expect(isVisible({ status: 'in_review' }, false)).toBe(false);
  });

  it('shows drafts on preview builds', () => {
    expect(isVisible({ status: 'draft' }, true)).toBe(true);
  });
});

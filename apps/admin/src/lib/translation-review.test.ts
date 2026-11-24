import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { onlyStatusChanged } from './lessons';
import {
  lessonParts,
  splitTranslationId,
  summariseTranslation,
  TRANSLATION,
  TRANSLATION_FILE,
  translationIds,
  translationPath,
  withTranslationStatus
} from './translation-review';

const root = join(import.meta.dirname, '../../../../');
const zu = readFileSync(join(root, 'content/lessons/p1-crank-01/index.zu.md'), 'utf8');
const en = readFileSync(join(root, 'content/lessons/p1-crank-01/index.md'), 'utf8');

describe('lesson translations in the back office', () => {
  it('ids are "<lesson>/<language>" and map to index.<language>.md', () => {
    expect(splitTranslationId('p1-crank-01/zu')).toEqual({ lesson: 'p1-crank-01', lang: 'zu' });
    expect(translationPath('p1-crank-01/zu')).toBe('content/lessons/p1-crank-01/index.zu.md');
    expect(() => splitTranslationId('p1-crank-01/en')).toThrow();
    expect(() => splitTranslationId('p1-crank-01')).toThrow();
    expect(TRANSLATION_FILE.test('content/lessons/p1-crank-01/index.zu.md')).toBe(true);
    expect(TRANSLATION_FILE.test('content/lessons/p1-crank-01/index.md')).toBe(false);
    expect(
      translationIds(
        [
          'content/lessons/p1-crank-01/index.md',
          'content/lessons/p1-crank-01/index.zu.md',
          'content/lessons/p1-cam-01/index.xh.md',
          'content/lessons/p1-cam-01/images/x.svg'
        ],
        'zu'
      )
    ).toEqual(['p1-crank-01/zu']);
  });

  it('reads the isiZulu crank rhino draft', () => {
    const t = summariseTranslation('p1-crank-01/zu', zu);
    expect(t).toMatchObject({
      title: 'Ubhejane olunqekuzisa ikhanda nge-crank',
      status: 'draft',
      reviewedBy: null,
      aiGenerated: true,
      buildTestedBy: 'n/a'
    });
    expect(t.translatedFrom).toMatch(/^[0-9a-f]{16}$/);
  });

  it('approving changes only the status lines, and publishes it', () => {
    const t = summariseTranslation('p1-crank-01/zu', zu);
    const after = TRANSLATION.withStatus(zu, TRANSLATION.after(t, 'approved', 'Reviewer 3'));
    expect(onlyStatusChanged(zu, after)).toBe(true);
    expect(summariseTranslation('p1-crank-01/zu', after)).toMatchObject({
      status: 'published',
      reviewedBy: 'Reviewer 3'
    });
    expect(onlyStatusChanged(zu, after.replace('Bikezela', 'Qagela'))).toBe(false);
    expect(() => withTranslationStatus('no front matter', { status: 'draft' })).toThrow();
  });

  it('cuts both files into the same parts to show side by side', () => {
    const a = lessonParts(en);
    const b = lessonParts(zu);
    expect(a.map((p) => p.heading)).toEqual([
      'Front matter',
      'Predict',
      'Run',
      'Investigate',
      'Modify',
      'Make',
      'Teacher notes'
    ]);
    expect(b).toHaveLength(a.length);
    expect(b[1]?.heading).toBe('Bikezela');
  });
});

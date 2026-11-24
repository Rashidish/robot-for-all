import { describe, expect, it } from 'vitest';
import {
  headings,
  translationHash,
  translationProblems,
  translationSource,
  translationView
} from './translation';

const english = `---
id: p1-crank-01
title: Crank-powered waving rhino
status: draft
ai_generated: true
reviewed_by: null
build_tested_by: null
---

## Predict
`;

describe('translated_from: which English text a translation was made from', () => {
  it('ignores the review lines, so publishing the English lesson does not stale it', async () => {
    const published = english
      .replace('status: draft', 'status: published')
      .replace('reviewed_by: null', 'reviewed_by: A Reviewer')
      .replace('build_tested_by: null', 'build_tested_by: A Builder');
    expect(await translationHash(published)).toBe(await translationHash(english));
    expect(await translationHash(english.replace(/\n/g, '\r\n'))).toBe(
      await translationHash(english)
    );
    expect(translationSource(english)).not.toContain('status');
  });

  it('changes when the words change', async () => {
    const hash = await translationHash(english);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(await translationHash(english.replace('waving', 'dancing'))).not.toBe(hash);
  });
});

describe('a translation lines up with its English lesson', () => {
  const en = {
    outcomes: ['a', 'b'],
    concepts: ['crank'],
    parts: [{ item: 'card', substitute: 'cereal box' }, { item: 'straw' }],
    safety: { notes: ['careful'] },
    assessment: ['I can x', 'I can y', 'I can z']
  };
  const words = {
    title: 'Ubhejane',
    outcomes: ['a', 'b'],
    concepts: ['i-crank'],
    parts: [{ item: 'ikhadi', substitute: 'ibhokisi' }, { item: 'utshani' }],
    safety_notes: ['qaphela'],
    assessment: ['Ngiyakwazi x', 'Ngiyakwazi y', 'Ngiyakwazi z']
  };
  const body = '## Predict\n\n## Run\n';
  const zuBody = '## Bikezela\n\n## Qalisa\n';

  it('passes when every list and section matches', () => {
    expect(translationProblems(en, body, words, zuBody)).toEqual([]);
    expect(headings(zuBody)).toEqual(['Bikezela', 'Qalisa']);
  });

  it('finds a missing item, a missing substitute and a missing section', () => {
    const problems = translationProblems(
      en,
      body,
      {
        ...words,
        outcomes: ['a'],
        parts: [{ item: 'ikhadi' }, { item: 'utshani', substitute: 'okunye' }]
      },
      '## Bikezela\n'
    );
    expect(problems).toHaveLength(4);
    expect(problems.join('\n')).toMatch(/outcomes.*2.*1/);
    expect(problems.join('\n')).toMatch(/sections/);
  });
});

describe('which lesson a page in another language shows', () => {
  it('production: only a published, up-to-date translation; otherwise English', () => {
    expect(translationView('published', false, false)).toBe('live');
    expect(translationView('published', true, false)).toBe('english');
    expect(translationView('in_review', false, false)).toBe('english');
    expect(translationView('draft', false, false)).toBe('english');
  });

  it('drafts preview: every translation, with a notice when not live', () => {
    expect(translationView('published', false, true)).toBe('live');
    expect(translationView('published', true, true)).toBe('stale');
    expect(translationView('draft', false, true)).toBe('draft');
  });
});

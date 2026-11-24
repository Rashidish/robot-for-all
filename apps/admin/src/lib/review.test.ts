import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GitHub, Pull } from './github';
import { summarise } from './lessons';
import { decide, possibleDecisions, pullsByLesson } from './review';

const PATH = 'content/lessons/p2-art-01/index.md';
const text = readFileSync(join(import.meta.dirname, '../../../../', PATH), 'utf8');

function fakeGitHub() {
  const proposed: { branch: string; path: string; text: string }[] = [];
  const closed: number[] = [];
  const gh = {
    lastPullNumber: 0,
    readFile: async () => ({ text, sha: 'sha-1' }),
    proposeChange: async (c: { branch: string; path: string; text: string }) => {
      proposed.push(c);
      gh.lastPullNumber = 55;
      return 'https://github.com/Rashidish/robots-for-all/pull/55';
    },
    closePull: async (n: number) => void closed.push(n)
  };
  return { gh: gh as unknown as GitHub, proposed, closed };
}
function fakeSupabase(error: { message: string } | null) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    client: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return { error };
      }
    } as unknown as Parameters<typeof decide>[1]
  };
}
const input = {
  lessonId: 'p2-art-01',
  decision: 'sent_for_review' as const,
  checklist: null,
  notes: '',
  overrideReason: '',
  reviewerName: null,
  who: 'Editor',
  now: new Date('2026-11-24T15:00:00Z')
};

describe('content review decisions', () => {
  it('offers the decisions that fit the status', () => {
    const l = summarise('p2-art-01', text);
    expect(possibleDecisions(l)).toEqual(['sent_for_review', 'build_tested']);
    expect(possibleDecisions({ ...l, status: 'in_review' })).toEqual([
      'approved',
      'changes_requested',
      'build_tested'
    ]);
    expect(
      possibleDecisions({ ...l, status: 'published', reviewedBy: 'R', buildTestedBy: 'T' })
    ).toEqual(['unpublished']);
  });

  it('a decision opens one status-only pull request and records it with its link', async () => {
    const { gh, proposed } = fakeGitHub();
    const sb = fakeSupabase(null);
    const url = await decide(gh, sb.client, input);
    expect(url).toBe('https://github.com/Rashidish/robots-for-all/pull/55');
    expect(proposed).toHaveLength(1);
    expect(proposed[0]?.branch).toBe('admin/lesson-p2-art-01-20261124-150000');
    expect(proposed[0]?.path).toBe(PATH);
    expect(proposed[0]?.text).toContain('status: in_review');
    expect(sb.calls).toEqual([
      {
        fn: 'record_review',
        args: expect.objectContaining({
          p_id: 'p2-art-01',
          p_decision: 'sent_for_review',
          p_pull_request: url
        })
      }
    ]);
    expect(
      pullsByLesson([{ head: { ref: proposed[0]?.branch ?? '', sha: 'x' } } as Pull]).has(
        'p2-art-01'
      )
    ).toBe(true);
  });

  it('when the database refuses, the pull request is closed again', async () => {
    const { gh, closed } = fakeGitHub();
    const sb = fakeSupabase({ message: 'only a content editor can send for review' });
    await expect(decide(gh, sb.client, input)).rejects.toThrow(/only a content editor/);
    expect(closed).toEqual([55]);
  });

  it('refuses a decision that does not fit the status, before touching GitHub', async () => {
    const { gh, proposed } = fakeGitHub();
    const sb = fakeSupabase(null);
    await expect(decide(gh, sb.client, { ...input, decision: 'unpublished' })).rejects.toThrow(
      /does not fit/
    );
    expect(proposed).toEqual([]);
    expect(sb.calls).toEqual([]);
  });
});

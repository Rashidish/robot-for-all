import { describe, expect, it } from 'vitest';
import type { GitHub } from './github';
import { changeWithdrawn } from './withdraw';

const empty = '{\n  "items": []\n}\n';
function fakes(listText: string, dbError: { message: string } | null = null) {
  const proposed: { branch: string; path: string; text: string }[] = [];
  const closed: number[] = [];
  const rpc: { fn: string; args: Record<string, unknown> }[] = [];
  const gh = {
    lastPullNumber: 0,
    readFile: async () => ({ text: listText, sha: 'list-sha' }),
    proposeChange: async (c: { branch: string; path: string; text: string }) => {
      proposed.push(c);
      gh.lastPullNumber = 9;
      return 'https://github.com/Rashidish/robots-for-all/pull/9';
    },
    closePull: async (n: number) => void closed.push(n)
  };
  const supabase = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpc.push({ fn, args });
      return { error: dbError };
    }
  } as unknown as Parameters<typeof changeWithdrawn>[1];
  return { gh: gh as unknown as GitHub, supabase, proposed, closed, rpc };
}
const input = {
  action: 'withdraw' as const,
  type: 'template' as const,
  id: 'p1-crank-01/rhino-parts',
  reason: 'Wrong fold line on the leg',
  who: 'Reviewer 3',
  now: new Date('2026-11-24T23:30:00Z')
};

describe('withdraw and restore from the back office', () => {
  it('withdrawing adds one item (South African date) in one pull request, recorded', async () => {
    const f = fakes(empty);
    await changeWithdrawn(f.gh, f.supabase, input);
    expect(f.proposed[0]?.path).toBe('content/site/withdrawn.json');
    expect(f.proposed[0]?.branch).toBe(
      'admin/withdraw-template-p1-crank-01--rhino-parts-20261124-233000'
    );
    expect(JSON.parse(f.proposed[0]?.text ?? '')).toEqual({
      items: [
        {
          type: 'template',
          id: 'p1-crank-01/rhino-parts',
          reason: 'Wrong fold line on the leg',
          since: '2026-11-25'
        }
      ]
    });
    expect(f.rpc[0]).toMatchObject({
      fn: 'record_withdrawal',
      args: { p_decision: 'withdrawn', p_type: 'template' }
    });
  });

  it('restoring removes it', async () => {
    const listed = `${JSON.stringify({ items: [{ type: 'template', id: input.id, reason: input.reason, since: '2026-11-24' }] }, null, 2)}\n`;
    const f = fakes(listed);
    await changeWithdrawn(f.gh, f.supabase, {
      ...input,
      action: 'restore',
      reason: 'Fold line fixed and checked'
    });
    expect(f.proposed[0]?.text).toBe(empty);
    expect(f.rpc[0]?.args['p_decision']).toBe('restored');
  });

  it('refuses before touching GitHub: short reason, bad id, already withdrawn, not withdrawn', async () => {
    const f = fakes(empty);
    await expect(changeWithdrawn(f.gh, f.supabase, { ...input, reason: 'short' })).rejects.toThrow(
      /at least 10/
    );
    await expect(changeWithdrawn(f.gh, f.supabase, { ...input, id: '../etc' })).rejects.toThrow(
      /not a valid/
    );
    await expect(
      changeWithdrawn(f.gh, f.supabase, { ...input, action: 'restore' })
    ).rejects.toThrow(/not withdrawn/);
    expect(f.proposed).toEqual([]);
  });

  it('closes the pull request again when the database refuses', async () => {
    const f = fakes(empty, { message: 'only an owner or reviewer can withdraw or restore this' });
    await expect(changeWithdrawn(f.gh, f.supabase, input)).rejects.toThrow(
      /only an owner or reviewer/
    );
    expect(f.closed).toEqual([9]);
  });
});

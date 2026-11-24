import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GitHub } from './github';
import { mergeIfReady } from './merge';
import { makeWorldKind, pullsFor } from './review';
import { onlyWorldStatusChanged, summariseWorld, withWorldStatus } from './worlds';

const dir = join(import.meta.dirname, '../../../../content/worlds');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const read = (f: string) => readFileSync(join(dir, f), 'utf8');
const en = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../content/i18n/en.json'), 'utf8')
) as Record<string, string>;

describe('Content → Worlds & courses', () => {
  it('reads every world: the initial set is published, courses are marked', () => {
    expect(files).toHaveLength(14);
    for (const f of files) {
      const w = summariseWorld(f.replace('.json', ''), read(f), en);
      expect(w.status, f).toBe('published');
      expect(w.reviewedBy, f).toBe('Owner (initial set)');
      expect(w.title, f).not.toBe(w.id);
    }
    expect(summariseWorld('bump-maze', read('bump-maze.json'), en).isCourse).toBe(true);
    expect(summariseWorld('open-floor', read('open-floor.json'), en).isCourse).toBe(false);
  });

  it('changes only the status lines of every world file', () => {
    for (const f of files) {
      const before = read(f);
      const after = withWorldStatus(before, {
        status: 'draft',
        reviewedBy: null,
        buildTestedBy: 'T. Builder'
      });
      expect(onlyWorldStatusChanged(before, after), f).toBe(true);
      const parsed = JSON.parse(after) as Record<string, unknown>;
      expect(parsed['status']).toBe('draft');
      expect(parsed['reviewed_by']).toBeNull();
      expect(parsed['build_tested_by']).toBe('T. Builder');
      const strip = (o: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(o).filter(
            ([k]) => !['status', 'reviewed_by', 'build_tested_by'].includes(k)
          )
        );
      expect(strip(parsed)).toEqual(strip(JSON.parse(before) as Record<string, unknown>));
    }
    const before = read('bump-maze.json');
    expect(onlyWorldStatusChanged(before, before.replace('"size": 4', '"size": 5'))).toBe(false);
  });

  it('approving publishes a world; asking for changes takes the review away', () => {
    const kind = makeWorldKind(en);
    const w = {
      ...summariseWorld('bump-maze', read('bump-maze.json'), en),
      status: 'in_review' as const,
      reviewedBy: null
    };
    expect(kind.after(w, 'approved', 'R')).toEqual({ reviewedBy: 'R', status: 'published' });
    expect(kind.after(w, 'changes_requested', 'R')).toEqual({ status: 'draft', reviewedBy: null });
    expect(kind.after(w, 'build_tested', 'T')).toEqual({ buildTestedBy: 'T' });
    expect(kind.path('bump-maze')).toBe('content/worlds/bump-maze.json');
    expect(
      pullsFor('world', [
        { head: { ref: 'admin/world-bump-maze-20261124-150000', sha: 'x' } } as never
      ]).has('bump-maze')
    ).toBe(true);
  });

  it('the merge check accepts a world file whose status lines alone changed', async () => {
    const before = read('bump-maze.json');
    const after = withWorldStatus(before, { status: 'draft', reviewedBy: null });
    const fake = (head: string) => {
      const merged: string[] = [];
      const gh = {
        getPull: async () => ({
          number: 3,
          html_url: 'https://github.com/x/y/pull/3',
          title: 't',
          state: 'open',
          user: { login: 'app[bot]' },
          head: { ref: 'admin/world-bump-maze-20261124-150000', sha: 'h' },
          base: { ref: 'main' }
        }),
        pullFiles: async () => [{ filename: 'content/worlds/bump-maze.json', status: 'modified' }],
        readFile: async (_p: string, ref: string) => ({
          text: ref === 'main' ? before : head,
          sha: ref
        }),
        checks: async () => 'passed',
        merge: async (_n: number, sha: string) => void merged.push(sha)
      } as unknown as GitHub;
      return { gh, merged };
    };
    const ok = fake(after);
    expect(
      (await mergeIfReady(ok.gh, 3, { appLogin: 'app[bot]', decided: async () => true })).ok
    ).toBe(true);
    const bad = fake(after.replace('"size": 4', '"size": 5'));
    const r = await mergeIfReady(bad.gh, 3, { appLogin: 'app[bot]', decided: async () => true });
    expect(r.ok).toBe(false);
    expect(bad.merged).toEqual([]);
  });
});

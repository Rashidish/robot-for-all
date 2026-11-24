import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GitHub, Pull } from './github';
import { withStatus } from './lessons';
import { mergeIfReady } from './merge';

const PATH = 'content/lessons/p2-art-01/index.md';
const main = readFileSync(join(import.meta.dirname, '../../../../', PATH), 'utf8');
const APP = 'robots-for-all-back-office[bot]';
const URL = 'https://github.com/Rashidish/robots-for-all/pull/101';

/** A pretend GitHub with one pull request; every part can be changed per test. */
function fake(over: {
  pull?: Partial<Pull>;
  files?: { filename: string; status: string }[];
  head?: string;
  ci?: 'passed' | 'running' | 'failed';
}) {
  const merged: string[] = [];
  const pull: Pull = {
    number: 101,
    html_url: URL,
    title: 'Pen art: approved',
    state: 'open',
    user: { login: APP },
    head: { ref: 'admin/lesson-p2-art-01-20261124-150000', sha: 'head-sha' },
    base: { ref: 'main' },
    ...over.pull
  };
  const gh = {
    getPull: async () => pull,
    pullFiles: async () => over.files ?? [{ filename: PATH, status: 'modified' }],
    readFile: async (_path: string, ref: string) => ({
      text: ref === 'main' ? main : (over.head ?? withStatus(main, { status: 'in_review' })),
      sha: ref
    }),
    checks: async () => over.ci ?? 'passed',
    merge: async (_n: number, sha: string) => void merged.push(sha)
  } as unknown as GitHub;
  return { gh, merged };
}
const decided = (yes: boolean) => async () => yes;

describe('the back office merges only its own, status-only, checked, decided pull requests (ADR-0012)', () => {
  it('merges when all four hold, at the commit it checked', async () => {
    const { gh, merged } = fake({});
    const r = await mergeIfReady(gh, 101, { appLogin: APP, decided: decided(true) });
    expect(r).toMatchObject({ ok: true, waiting: [] });
    expect(merged).toEqual(['head-sha']);
  });

  it.each([
    [
      'opened by a person',
      { pull: { user: { login: 'someone' } } },
      'not opened by the back office'
    ],
    [
      'not from an admin/ branch',
      { pull: { head: { ref: 'feature/x', sha: 'h' } } },
      'back-office branch'
    ],
    ['not into main', { pull: { base: { ref: 'dev' } } }, 'does not go into main'],
    ['closed', { pull: { state: 'closed' } }, 'not open'],
    [
      'two files',
      {
        files: [
          { filename: PATH, status: 'modified' },
          { filename: 'apps/web/src/x.ts', status: 'modified' }
        ]
      },
      'more than one lesson file, world file or the withdrawn list'
    ],
    [
      'a code file',
      { files: [{ filename: 'apps/web/src/x.ts', status: 'modified' }] },
      'more than one lesson file, world file or the withdrawn list'
    ],
    [
      'a new file',
      { files: [{ filename: PATH, status: 'added' }] },
      'more than one lesson file, world file or the withdrawn list'
    ],
    [
      'lesson text changed too',
      { head: main.replace('Pen art', 'Pen art, edited') },
      'more than the status lines'
    ],
    ['checks still running', { ci: 'running' as const }, 'still running'],
    ['checks failed', { ci: 'failed' as const }, 'checks failed']
  ])('waits when %s', async (_name, over, reason) => {
    const { gh, merged } = fake(over);
    const r = await mergeIfReady(gh, 101, { appLogin: APP, decided: decided(true) });
    expect(r.ok).toBe(false);
    expect(r.waiting.join('; ')).toContain(reason);
    expect(merged).toEqual([]);
  });

  it('waits when no decision is recorded in the back office', async () => {
    const { gh, merged } = fake({});
    const r = await mergeIfReady(gh, 101, { appLogin: APP, decided: decided(false) });
    expect(r.waiting).toEqual(['no decision is recorded for it']);
    expect(merged).toEqual([]);
  });

  describe('the withdrawn list', () => {
    const W = 'content/site/withdrawn.json';
    const item = {
      type: 'world',
      id: 'bump-maze',
      reason: 'A wall is in the wrong place',
      since: '2026-11-24'
    };
    const list = (...items: object[]) => `${JSON.stringify({ items }, null, 2)}\n`;
    const withList = (mainText: string, headText: string) => {
      const merged: string[] = [];
      const gh = {
        getPull: async () => ({
          number: 7,
          html_url: URL,
          title: 'Withdraw bump-maze',
          state: 'open',
          user: { login: APP },
          head: { ref: 'admin/withdraw-world-bump-maze-20261124-150000', sha: 'head-sha' },
          base: { ref: 'main' }
        }),
        pullFiles: async () => [{ filename: W, status: 'modified' }],
        readFile: async (_p: string, ref: string) => ({
          text: ref === 'main' ? mainText : headText,
          sha: ref
        }),
        checks: async () => 'passed',
        merge: async (_n: number, sha: string) => void merged.push(sha)
      } as unknown as GitHub;
      return { gh, merged };
    };

    it('merges one item added, or one removed', async () => {
      for (const [a, b] of [
        [list(), list(item)],
        [list(item), list()]
      ]) {
        const { gh, merged } = withList(a ?? '', b ?? '');
        expect((await mergeIfReady(gh, 7, { appLogin: APP, decided: decided(true) })).ok).toBe(
          true
        );
        expect(merged).toEqual(['head-sha']);
      }
    });

    it('waits for two items at once, a changed reason, or a broken file', async () => {
      for (const [a, b] of [
        [list(), list(item, { ...item, id: 'line-maze' })],
        [list(item), list({ ...item, reason: 'Another long reason here' })],
        [list(), '{ broken']
      ]) {
        const { gh, merged } = withList(a ?? '', b ?? '');
        const r = await mergeIfReady(gh, 7, { appLogin: APP, decided: decided(true) });
        expect(r.ok).toBe(false);
        expect(merged).toEqual([]);
      }
    });
  });
});

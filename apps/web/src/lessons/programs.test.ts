import { describe, expect, it } from 'vitest';
import { fromFile } from '../code/files';
import { findProgram, starterLink } from './programs';

/** The program file a /code/#open=… link carries. */
function opened(link: string) {
  const code = /#open=([^&]+)/.exec(link)?.[1] ?? '';
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return fromFile(new TextDecoder().decode(bytes));
}

describe('starter program links', () => {
  it('open the lesson program as written, with its world', () => {
    const link = starterLink('p2-art-01', 'draw-a-square', 'art-floor') ?? '';
    expect(link).toMatch(/^\/code\/#open=[A-Za-z0-9_-]+&world=art-floor$/);
    expect(opened(link).name).toBe('Draw a square');
  });

  it('open it under a translated name, with exactly the same blocks (spec §2.6)', () => {
    const link = starterLink('p2-art-01', 'draw-a-square', null, 'Dweba isikwele') ?? '';
    const file = opened(link);
    expect(file.name).toBe('Dweba isikwele');
    expect(file.program).toEqual(findProgram('p2-art-01', 'draw-a-square')?.program);
  });

  it('give nothing for a program that does not exist', () => {
    expect(starterLink('p2-art-01', 'no-such-program')).toBeUndefined();
  });
});

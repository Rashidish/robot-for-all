import { describe, expect, it } from 'vitest';
import { lookUpHint, type OrganisationRow, routesFor, stateOf } from './organisations';

const school: OrganisationRow = {
  id: 'o1',
  kind: 'school',
  name: 'Sizwe Primary',
  province: 'KwaZulu-Natal',
  emis: '500123456',
  register_no: null,
  registered: true,
  verified_at: null,
  verified_route: null,
  reverify_by: null,
  created_at: '2026-11-25T00:00:00Z'
};

describe('People → Organisations', () => {
  it('offers only the routes that fit (spec §7.4)', () => {
    expect(routesFor('school', true)).toEqual([
      'official_email',
      'official_phone',
      'principal_letter'
    ]);
    expect(routesFor('club', true)).toContain('register');
    expect(routesFor('club', false)).toEqual(['vouched', 'references', 'call_and_reference']);
    expect(routesFor('club', false)).not.toContain('register');
  });

  it('knows what is waiting, verified or due for a re-check', () => {
    expect(stateOf(school, '2026-11-25')).toBe('waiting');
    const verified = {
      ...school,
      verified_at: '2026-11-25T10:00:00Z',
      verified_route: 'official_phone' as const,
      reverify_by: '2028-11-25'
    };
    expect(stateOf(verified, '2026-11-25')).toBe('verified');
    expect(stateOf(verified, '2028-11-25')).toBe('recheck_due');
  });

  it('tells the verifier where to look first', () => {
    expect(lookUpHint(school)).toMatch(/EMIS 500123456.*DBE/);
    expect(lookUpHint({ ...school, kind: 'club', emis: null, register_no: '123-456 NPO' })).toMatch(
      /NPO register/
    );
    expect(lookUpHint({ ...school, kind: 'club', emis: null, registered: false })).toMatch(
      /Not registered/
    );
  });
});

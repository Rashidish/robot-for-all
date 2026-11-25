import { describe, expect, it } from 'vitest';
import {
  enrolLink,
  inviteFromHash,
  inviteLink,
  organisationProblems,
  registerArgs,
  spacedCode,
  whatsappShare
} from './classes';

const school = {
  kind: 'school' as const,
  name: 'Sizwe Primary',
  province: 'KwaZulu-Natal',
  emis: '500123456',
  registered: true,
  registerNo: ''
};

describe('schools, clubs and classes', () => {
  it('a school needs its EMIS number; a registered club its registration number', () => {
    expect(organisationProblems(school)).toEqual([]);
    expect(organisationProblems({ ...school, emis: '12' })).toEqual(['account_org_emis_needed']);
    const club = { ...school, kind: 'club' as const, emis: '' };
    expect(organisationProblems(club)).toEqual(['account_org_register_needed']);
    expect(organisationProblems({ ...club, registered: false })).toEqual([]);
  });

  it('sends only what fits the kind', () => {
    expect(registerArgs(school)).toMatchObject({
      p_kind: 'school',
      p_emis: '500123456',
      p_register_no: null
    });
    expect(
      registerArgs({ ...school, kind: 'club', emis: '999999', registered: false, registerNo: 'x' })
    ).toMatchObject({ p_emis: null, p_register_no: null, p_registered: false });
  });

  it('builds the enrolment link, the spaced class code and a WhatsApp share', () => {
    expect(enrolLink('https://robotsforall.org.za/', 'a'.repeat(32))).toBe(
      `https://robotsforall.org.za/enrol/#${'a'.repeat(32)}`
    );
    expect(spacedCode('BCDFGH')).toBe('BCD FGH');
    expect(whatsappShare('Enrol here: https://x/enrol/#t')).toBe(
      'https://wa.me/?text=Enrol%20here%3A%20https%3A%2F%2Fx%2Fenrol%2F%23t'
    );
  });

  it('invitation links carry the secret after #, and only a well-formed one is read back', () => {
    const token = 'a'.repeat(64);
    expect(inviteLink('https://robotsforall.org.za', token)).toBe(
      `https://robotsforall.org.za/account/#invite=${token}`
    );
    expect(inviteFromHash(`#invite=${token}`)).toBe(token);
    expect(inviteFromHash('#invite=nope')).toBeNull();
    expect(inviteFromHash('')).toBeNull();
  });
});

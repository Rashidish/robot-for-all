import { describe, expect, it } from 'vitest';
import { childProblems, enrolTokenFromHash } from './enrol';

describe('enrolment by a parent', () => {
  it('reads only a well-formed class token from the address', () => {
    expect(enrolTokenFromHash(`#${'a'.repeat(32)}`)).toBe('a'.repeat(32));
    expect(enrolTokenFromHash('#nope')).toBeNull();
    expect(enrolTokenFromHash('')).toBeNull();
  });

  it('asks for a nickname, not a full name, and a grade', () => {
    expect(childProblems({ nickname: 'Rocket', grade: 4 })).toEqual([]);
    expect(childProblems({ nickname: 'Thandi R', grade: 4 })).toEqual([]);
    expect(childProblems({ nickname: 'Thandi Mkhize', grade: 4 })).toEqual([
      'enrol_nickname_not_full_name'
    ]);
    expect(childProblems({ nickname: 'x', grade: 0 })).toEqual([
      'enrol_nickname_length',
      'enrol_grade_needed'
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { languageProblems } from './languages';

describe('languages in the build (more content spec §2.5)', () => {
  it('the language list matches the interface files and the compiler', () => {
    expect(languageProblems()).toEqual([]);
  });
});
